import { reusableModuleSource } from "../lib/dither/generateModule";
import { canvasToBlob, downloadBlob, safeFileName } from "../lib/download";
import { blobBytes, makeZip, type ZipFile } from "../lib/zip";
import { clamp, sleep } from "../lib/util";
import { useStore } from "../state/useStore";
import type { Renderer } from "./Renderer";

function state() {
  return useStore.getState();
}
function durationValue(): number {
  return clamp(state().duration, 0.1, 60);
}
function fpsValue(): number {
  return clamp(Math.round(state().fps), 1, 60);
}

/** Export the current frame as a PNG. */
export async function exportPng(renderer: Renderer): Promise<void> {
  const s = state();
  s.setBusy(true);
  s.setProgress(0);
  s.setStatus("Rendering PNG…");
  try {
    const time = renderer.currentTimeSeconds();
    await renderer.waitIdle();
    await renderer.renderAt(time, true);
    const blob = await canvasToBlob(renderer.canvas);
    downloadBlob(blob, safeFileName("bayer-frame", "png"));
    s.setProgress(1);
    s.setStatus("PNG exported");
  } catch (error) {
    s.setStatus(message(error), true);
  } finally {
    s.setBusy(false);
    setTimeout(() => s.setProgress(0), 700);
  }
}

/** Export the whole timeline as a ZIP of PNG frames + manifest + source. */
export async function exportSequence(renderer: Renderer): Promise<void> {
  const duration = durationValue();
  const fps = fpsValue();
  const total = Math.max(1, Math.ceil(duration * fps));
  if (total > 1200) {
    throw new Error("Sequence is over 1200 frames. Lower duration or FPS.");
  }
  const s = state();
  s.setBusy(true);
  s.setProgress(0);
  s.setStatus(`Rendering ${total} PNG frames…`);
  const files: ZipFile[] = [];
  try {
    for (let index = 0; index < total; index += 1) {
      await renderer.waitIdle();
      await renderer.renderAt(index / fps, true);
      const png = await canvasToBlob(renderer.canvas);
      files.push({
        name: `frames/frame-${String(index).padStart(5, "0")}.png`,
        data: await blobBytes(png),
      });
      s.setProgress((index + 1) / (total + 1));
      s.setStatus(`PNG sequence ${index + 1} / ${total}`);
      await sleep(0);
    }
    const manifest = {
      width: renderer.canvas.width,
      height: renderer.canvas.height,
      duration,
      fps,
      frames: total,
      dither: state().options,
      source: "source.html",
    };
    files.push({
      name: "manifest.json",
      data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)),
    });
    files.push({
      name: "source.html",
      data: new TextEncoder().encode(state().source),
    });
    const zip = makeZip(files);
    downloadBlob(zip, safeFileName("bayer-png-sequence", "zip"));
    s.setProgress(1);
    s.setStatus(`Exported ${total} PNG frames`);
  } catch (error) {
    console.error(error);
    s.setStatus(message(error), true);
  } finally {
    s.setBusy(false);
    setTimeout(() => s.setProgress(0), 900);
  }
}

function supportedWebmType(): string {
  const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return (
    candidates.find(
      (type) => window.MediaRecorder && MediaRecorder.isTypeSupported(type),
    ) || ""
  );
}

/** Record the timeline to a WebM video (browser-permitting). */
export async function exportWebm(renderer: Renderer): Promise<void> {
  const canvas = renderer.canvas;
  if (!canvas.captureStream || !window.MediaRecorder) {
    throw new Error("This browser cannot record a canvas WebM.");
  }
  const mimeType = supportedWebmType();
  if (!mimeType) throw new Error("No WebM encoder is available in this browser.");
  const duration = durationValue();
  const fps = fpsValue();
  const total = Math.max(1, Math.ceil(duration * fps));
  if (total > 1200) {
    throw new Error("Video is over 1200 frames. Lower duration or FPS.");
  }
  const s = state();
  s.setBusy(true);
  s.setProgress(0);
  s.setStatus(`Recording ${total} frames…`);
  try {
    const stream = canvas.captureStream(fps);
    const track = stream.getVideoTracks()[0];
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 14_000_000,
    });
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    const stopped = new Promise<void>((resolve, reject) => {
      recorder.onstop = () => resolve();
      recorder.onerror = () => reject(new Error("MediaRecorder failed."));
    });
    recorder.start();
    const interval = 1000 / fps;
    const start = performance.now();
    for (let index = 0; index < total; index += 1) {
      await renderer.waitIdle();
      await renderer.renderAt(index / fps, true);
      if ("requestFrame" in track) {
        (track as CanvasCaptureMediaStreamTrack).requestFrame();
      }
      s.setProgress((index + 1) / total);
      s.setStatus(`WebM frame ${index + 1} / ${total}`);
      const target = start + (index + 1) * interval;
      await sleep(Math.max(0, target - performance.now()));
    }
    await sleep(interval);
    recorder.stop();
    await stopped;
    track.stop();
    downloadBlob(
      new Blob(chunks, { type: mimeType }),
      safeFileName("bayer-animation", "webm"),
    );
    s.setProgress(1);
    s.setStatus("WebM exported");
  } catch (error) {
    console.error(error);
    s.setStatus(message(error), true);
  } finally {
    s.setBusy(false);
    setTimeout(() => s.setProgress(0), 900);
  }
}

/** Download a standalone JS module reproducing the current dither settings. */
export function exportModule(): void {
  const blob = new Blob([reusableModuleSource(state().options)], {
    type: "text/javascript;charset=utf-8",
  });
  downloadBlob(blob, "bayer-dither.js");
  state().setStatus("Reusable JS filter exported");
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
