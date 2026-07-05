import html2canvas from "html2canvas";

import { ditherImageData } from "../lib/dither/ditherImageData";
import { buildPreviewDocument } from "../lib/preview";
import { snapshotDocumentAnimations } from "../lib/animationSnapshot";
import { containRect } from "../lib/fit";
import { clamp } from "../lib/util";
import { currentDimensions, useStore } from "../state/useStore";
import type { Dimensions } from "../types";

/** DOM elements the renderer drives, handed over by React refs. */
export interface RendererElements {
  sourceFrame: HTMLIFrameElement;
  captureFrame: HTMLIFrameElement;
  outputCanvas: HTMLCanvasElement;
}

/** Longest video window we ingest, in seconds (long videos are trimmed to this). */
const MAX_VIDEO_SECONDS = 10;

/**
 * Owns the imperative render pipeline: source iframes / loaded media, offscreen
 * capture, html2canvas rasterization (HTML) or direct draw (image/video), the
 * Bayer dither pass, and the playback clock. React supplies the DOM elements;
 * all tuning is read live from the store.
 */
export class Renderer {
  private sourceFrame!: HTMLIFrameElement;
  private captureFrame!: HTMLIFrameElement;
  private outputCanvas!: HTMLCanvasElement;
  private outputContext!: CanvasRenderingContext2D;

  private readonly workCanvas = document.createElement("canvas");
  private readonly workContext = ctx(this.workCanvas);
  private readonly sourceCanvas = document.createElement("canvas");
  private readonly sourceContext = ctx(this.sourceCanvas);

  // Loaded media (image/video modes). Owned here, not in React state.
  private image: HTMLImageElement | null = null;
  private video: HTMLVideoElement | null = null;
  private mediaUrl = "";
  private mediaDuration = 0;

  // Imperative flags — deliberately NOT React state so the rAF loop is cheap.
  private renderBusy = false;
  private renderGeneration = 0;
  private captureLoaded = false;
  private lastRenderError = "";
  private startClock = performance.now();
  private pausedAt = 0;
  private lastPreviewClock = 0;
  private rafId = 0;

  private readonly onSourceLoad = () => {
    if (!this.captureLoaded) this.setStatus("Preview loaded; preparing capture…");
  };
  private readonly onCaptureLoad = async () => {
    if (this.store.sourceType !== "html") return;
    this.captureLoaded = true;
    this.setStatus("Source loaded");
    await sleep(50);
    void this.renderAt(0);
  };

  /** Bind DOM elements and begin listening for iframe loads. Idempotent. */
  attach(elements: RendererElements): void {
    this.sourceFrame = elements.sourceFrame;
    this.captureFrame = elements.captureFrame;
    this.outputCanvas = elements.outputCanvas;
    this.outputContext = ctx(this.outputCanvas);
    this.sourceFrame.addEventListener("load", this.onSourceLoad);
    this.captureFrame.addEventListener("load", this.onCaptureLoad);
  }

  /** Detach listeners and stop the loop (React unmount / StrictMode remount). */
  detach(): void {
    this.stopLoop();
    this.sourceFrame?.removeEventListener("load", this.onSourceLoad);
    this.captureFrame?.removeEventListener("load", this.onCaptureLoad);
  }

  // ---- store-backed reads --------------------------------------------------

  private get store() {
    return useStore.getState();
  }
  private dimensions(): Dimensions {
    return currentDimensions(this.store);
  }
  private durationValue(): number {
    const duration = clamp(this.store.duration, 0.1, 60);
    if (this.store.sourceType === "video" && this.mediaDuration > 0) {
      return Math.min(duration, this.mediaDuration);
    }
    return duration;
  }
  private setStatus(message: string, error = false): void {
    this.store.setStatus(message, error);
  }

  // ---- source loading ------------------------------------------------------

  /** (Re)load the authored HTML source into both iframes and resize canvases. */
  applySource(): void {
    this.clearMedia();
    this.store.setMedia("html", "");
    this.renderGeneration += 1;
    this.captureLoaded = false;
    this.lastRenderError = "";
    const { width, height } = this.dimensions();
    for (const frame of [this.sourceFrame, this.captureFrame]) {
      frame.style.width = `${width}px`;
      frame.style.height = `${height}px`;
      frame.width = String(width);
      frame.height = String(height);
    }
    const previewDocument = buildPreviewDocument(this.store.source);
    this.sourceFrame.srcdoc = previewDocument;
    this.captureFrame.srcdoc = previewDocument;
    this.outputCanvas.width = width;
    this.outputCanvas.height = height;
    this.startClock = performance.now();
    this.pausedAt = 0;
    this.store.setPlaying(true);
    this.store.setCurrentTime(0);
    this.setStatus("Loading source…");
  }

  /** Re-render after a capture-dimension change, respecting the source type. */
  reflow(): void {
    if (this.store.sourceType === "html") {
      this.applySource();
    } else {
      this.renderGeneration += 1;
      void this.renderAt(this.currentTimeSeconds(), true);
    }
  }

  /** Load an image file as the source (static, contain-fit). */
  async loadImageFile(file: File): Promise<void> {
    const url = this.beginMediaLoad("image", file, "Loading image…");
    const image = new Image();
    image.decoding = "async";
    this.image = image;
    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Could not load that image file."));
        image.src = url;
      });
    } catch (error) {
      this.setStatus(message(error), true);
      return;
    }
    this.previewMedia("image", url);
    this.store.setPlaying(false);
    this.captureLoaded = true;
    this.setStatus(`Image loaded — ${file.name}`);
    await this.renderAt(0);
  }

  /** Load a video file as the source; long videos are trimmed to the first 10s. */
  async loadVideoFile(file: File): Promise<void> {
    const url = this.beginMediaLoad("video", file, "Loading video…");
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    this.video = video;
    try {
      await new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => resolve();
        video.onerror = () => reject(new Error("Could not load that video file."));
        video.src = url;
      });
    } catch (error) {
      this.setStatus(message(error), true);
      return;
    }
    const full = Number.isFinite(video.duration) ? video.duration : MAX_VIDEO_SECONDS;
    this.mediaDuration = Math.min(Math.max(full, 0.1), MAX_VIDEO_SECONDS);
    this.store.setDuration(Number(this.mediaDuration.toFixed(3)));
    this.previewMedia("video", url);
    this.startClock = performance.now();
    this.pausedAt = 0;
    this.store.setPlaying(true);
    this.store.setCurrentTime(0);
    this.captureLoaded = true;
    const trimmed = full > MAX_VIDEO_SECONDS ? ` (trimmed to ${MAX_VIDEO_SECONDS}s)` : "";
    this.setStatus(`Video loaded — ${file.name}${trimmed}`);
    await this.renderAt(0);
  }

  private beginMediaLoad(
    type: "image" | "video",
    file: File,
    status: string,
  ): string {
    this.clearMedia();
    this.renderGeneration += 1;
    this.captureLoaded = false;
    this.lastRenderError = "";
    this.mediaUrl = URL.createObjectURL(file);
    this.store.setMedia(type, file.name);
    this.store.setCurrentTime(0);
    this.pausedAt = 0;
    this.setStatus(status);
    return this.mediaUrl;
  }

  /** Point the live Source preview iframe at the loaded media. */
  private previewMedia(type: "image" | "video", url: string): void {
    const { width, height } = this.dimensions();
    this.sourceFrame.style.width = `${width}px`;
    this.sourceFrame.style.height = `${height}px`;
    this.sourceFrame.width = String(width);
    this.sourceFrame.height = String(height);
    this.captureFrame.srcdoc = "";
    const inner =
      type === "video"
        ? `<video src="${url}" autoplay loop muted playsinline></video>`
        : `<img src="${url}" alt="">`;
    this.sourceFrame.srcdoc = `<!doctype html><html><head><style>html,body{margin:0;width:100%;height:100%;background:transparent}body{display:grid;place-items:center}img,video{max-width:100%;max-height:100%;display:block}</style></head><body>${inner}</body></html>`;
  }

  private clearMedia(): void {
    if (this.video) {
      try {
        this.video.pause();
      } catch {
        /* ignore */
      }
      this.video.removeAttribute("src");
      this.video.load();
      this.video = null;
    }
    this.image = null;
    this.mediaDuration = 0;
    if (this.mediaUrl) {
      URL.revokeObjectURL(this.mediaUrl);
      this.mediaUrl = "";
    }
  }

  // ---- rasterize + dither --------------------------------------------------

  private async rasterizeSourceAt(seconds: number): Promise<void> {
    switch (this.store.sourceType) {
      case "image":
        return this.rasterizeImage();
      case "video":
        return this.rasterizeVideoAt(seconds);
      default:
        return this.rasterizeHtmlAt(seconds);
    }
  }

  /** Contain-fit + magnify a media element into the source canvas. */
  private drawMedia(
    media: CanvasImageSource,
    mediaWidth: number,
    mediaHeight: number,
  ): void {
    const { width, height } = this.dimensions();
    const options = this.store.options;
    const scale = Math.max(1, this.store.sourceScale);
    this.sourceCanvas.width = width;
    this.sourceCanvas.height = height;
    this.sourceContext.setTransform(1, 0, 0, 1, 0, 0);
    this.sourceContext.clearRect(0, 0, width, height);
    if (!options.preserveAlpha) {
      this.sourceContext.fillStyle = options.matte;
      this.sourceContext.fillRect(0, 0, width, height);
    }
    this.sourceContext.imageSmoothingEnabled = true;
    const rect = containRect(mediaWidth, mediaHeight, width, height, scale);
    this.sourceContext.drawImage(media, rect.x, rect.y, rect.width, rect.height);
  }

  private rasterizeImage(): void {
    const image = this.image;
    if (!image || !image.complete || !image.naturalWidth) {
      throw new Error("Image is still loading.");
    }
    this.drawMedia(image, image.naturalWidth, image.naturalHeight);
  }

  private async rasterizeVideoAt(seconds: number): Promise<void> {
    const video = this.video;
    if (!video || video.readyState < 2 || !video.videoWidth) {
      throw new Error("Video is still loading.");
    }
    const cap = this.mediaDuration > 0 ? this.mediaDuration : video.duration;
    const target = Math.min(Math.max(0, seconds), Math.max(0, cap - 0.001));
    if (Math.abs(video.currentTime - target) > 0.02) {
      await seekVideo(video, target);
    }
    this.drawMedia(video, video.videoWidth, video.videoHeight);
  }

  private async rasterizeHtmlAt(seconds: number): Promise<void> {
    if (typeof html2canvas !== "function") {
      throw new Error("The built-in DOM renderer did not load.");
    }
    const { width, height } = this.dimensions();
    const doc = this.captureFrame.contentDocument;
    if (
      !this.captureLoaded ||
      !doc ||
      !doc.documentElement ||
      !this.captureFrame.contentWindow
    ) {
      throw new Error("Capture frame is still loading.");
    }
    if (doc.fonts?.ready) await doc.fonts.ready;

    const options = this.store.options;
    // Magnify: crop the centered 1/scale region and upscale it to the full
    // output via html2canvas `scale`, so the object is re-rasterized sharp at
    // higher effective resolution (finer dither) — matching the Source preview.
    const scale = Math.max(1, this.store.sourceScale);
    const cropWidth = Math.max(1, Math.round(width / scale));
    const cropHeight = Math.max(1, Math.round(height / scale));
    const cropX = Math.round((width - cropWidth) / 2);
    const cropY = Math.round((height - cropHeight) / 2);
    const animationSnapshot = await snapshotDocumentAnimations(doc, seconds);
    try {
      const rendered = await html2canvas(doc.documentElement, {
        backgroundColor: null,
        width: cropWidth,
        height: cropHeight,
        windowWidth: width,
        windowHeight: height,
        x: cropX,
        y: cropY,
        scrollX: 0,
        scrollY: 0,
        scale,
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 5000,
        removeContainer: true,
        foreignObjectRendering: false,
        onclone: (clonedDoc) => animationSnapshot.apply(clonedDoc),
      });
      this.sourceCanvas.width = width;
      this.sourceCanvas.height = height;
      this.sourceContext.setTransform(1, 0, 0, 1, 0, 0);
      this.sourceContext.clearRect(0, 0, width, height);
      if (!options.preserveAlpha) {
        this.sourceContext.fillStyle = options.matte;
        this.sourceContext.fillRect(0, 0, width, height);
      }
      this.sourceContext.drawImage(rendered, 0, 0, width, height);
    } finally {
      animationSnapshot.cleanup();
    }
  }

  private processSourceCanvas(): void {
    const { width, height } = this.dimensions();
    const options = this.store.options;
    const pixelSize = Math.max(1, Math.round(options.pixelSize));
    const workWidth = Math.max(1, Math.ceil(width / pixelSize));
    const workHeight = Math.max(1, Math.ceil(height / pixelSize));
    this.workCanvas.width = workWidth;
    this.workCanvas.height = workHeight;
    this.workContext.imageSmoothingEnabled = true;
    this.workContext.clearRect(0, 0, workWidth, workHeight);
    this.workContext.drawImage(
      this.sourceCanvas,
      0,
      0,
      width,
      height,
      0,
      0,
      workWidth,
      workHeight,
    );
    const pixels = this.workContext.getImageData(0, 0, workWidth, workHeight);
    ditherImageData(pixels, options);
    this.workContext.putImageData(pixels, 0, 0);

    this.outputCanvas.width = width;
    this.outputCanvas.height = height;
    this.outputContext.imageSmoothingEnabled = false;
    this.outputContext.clearRect(0, 0, width, height);
    if (!options.preserveAlpha) {
      this.outputContext.fillStyle = options.matte;
      this.outputContext.fillRect(0, 0, width, height);
    }
    this.outputContext.drawImage(
      this.workCanvas,
      0,
      0,
      workWidth,
      workHeight,
      0,
      0,
      width,
      height,
    );
  }

  /** Render (rasterize + dither) the frame at `seconds`. Returns success. */
  async renderAt(seconds: number, quiet = false): Promise<boolean> {
    if (this.renderBusy) return false;
    this.renderBusy = true;
    const generation = this.renderGeneration;
    try {
      await this.rasterizeSourceAt(seconds);
      if (generation !== this.renderGeneration) return false;
      this.processSourceCanvas();
      // Clear a stale (possibly transient html2canvas) error once we recover,
      // even on a quiet live-loop frame, so it never sticks in the status bar.
      const recovered = this.lastRenderError !== "";
      this.lastRenderError = "";
      if (!quiet || recovered) this.setStatus(`Rendered ${seconds.toFixed(3)}s`);
      return true;
    } catch (error) {
      const msg = message(error);
      if (!quiet || msg !== this.lastRenderError) {
        console.error(error);
        this.setStatus(msg, true);
      }
      this.lastRenderError = msg;
      return false;
    } finally {
      this.renderBusy = false;
    }
  }

  // ---- playback clock ------------------------------------------------------

  currentTimeSeconds(clock = performance.now()): number {
    const duration = this.durationValue();
    return this.store.playing
      ? ((clock - this.startClock) / 1000) % duration
      : clamp(this.pausedAt, 0, duration);
  }

  /** Wait for any in-flight render, then render the current playhead exactly. */
  async waitIdle(): Promise<void> {
    while (this.renderBusy) await sleep(4);
  }

  get isRenderBusy(): boolean {
    return this.renderBusy;
  }
  get isCaptureLoaded(): boolean {
    return this.captureLoaded;
  }
  /** The visible output canvas (for PNG/ZIP/WebM export). */
  get canvas(): HTMLCanvasElement {
    return this.outputCanvas;
  }

  // ---- transport controls (mirror the store's `playing`) -------------------

  play(): void {
    this.startClock = performance.now() - this.pausedAt * 1000;
    this.store.setPlaying(true);
  }
  pause(): void {
    this.pausedAt = this.currentTimeSeconds();
    this.store.setPlaying(false);
    void this.renderAt(this.pausedAt);
  }
  restart(): void {
    this.startClock = performance.now();
    this.pausedAt = 0;
    void this.renderAt(0);
  }
  seek(time: number): void {
    this.pausedAt = time;
    this.store.setPlaying(false);
    this.store.setCurrentTime(time);
    void this.renderAt(time, true);
  }
  /** Re-render the paused frame after a control change (quiet). */
  rerenderIfPaused(): void {
    if (this.captureLoaded && !this.store.busy && !this.store.playing) {
      void this.renderAt(this.pausedAt, true);
    }
  }

  // ---- animation loop ------------------------------------------------------

  startLoop(): void {
    this.stopLoop();
    const loop = (clock: number) => {
      const time = this.currentTimeSeconds(clock);
      this.store.setCurrentTime(time);
      const s = this.store;
      if (
        s.liveDither &&
        this.captureLoaded &&
        !s.busy &&
        !this.renderBusy &&
        clock - this.lastPreviewClock >= 100
      ) {
        this.lastPreviewClock = clock;
        void this.renderAt(time, true);
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }
  stopLoop(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }
}

function ctx(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d", {
    alpha: true,
    willReadFrequently: true,
  });
  if (!context) throw new Error("Could not acquire a 2D canvas context.");
  return context;
}

/** Seek a video and resolve on the `seeked` event (with a timeout fallback). */
function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      video.removeEventListener("seeked", finish);
      resolve();
    };
    video.addEventListener("seeked", finish, { once: true });
    video.currentTime = time;
    setTimeout(finish, 300);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
