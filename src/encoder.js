// Deterministic clip export via WebCodecs. Instead of capturing the canvas in
// real time (MediaRecorder — lossy timing, no seek metadata, WebM-only), we walk
// the source clip frame-by-frame, render each ASCII frame, and hardware-encode it
// with a VideoEncoder into a real, seekable MP4 (H.264) or WebM (VP9) container.

import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4Target } from 'mp4-muxer';
import { Muxer as WebmMuxer, ArrayBufferTarget as WebmTarget } from 'webm-muxer';
import { state } from './state.js';
import { video, canvas } from './dom.js';
import { toast, downloadBlob } from './util.js';
import { processFrame, resetTemporalState } from './engine.js';

// Codec strings tried in order; the first the platform actually supports wins.
const H264_CANDIDATES = ['avc1.640034', 'avc1.640028', 'avc1.4d0028', 'avc1.42e01e'];
const VP9_CANDIDATES = ['vp09.00.31.08', 'vp09.00.10.08'];

export function isExportSupported() {
  return typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';
}

async function pickCodec(candidates, config) {
  for (const codec of candidates) {
    try {
      const support = await VideoEncoder.isConfigSupported({ ...config, codec });
      if (support.supported) return codec;
    } catch { /* try next */ }
  }
  return null;
}

// Seek the source video and resolve once the frame at (or nearest) `t` is ready.
function seekTo(t) {
  return new Promise((resolve) => {
    const target = Math.max(0, Math.min(t, video.duration || 0));
    if (Math.abs(video.currentTime - target) < 1e-4 && video.readyState >= 2) { resolve(); return; }
    const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve(); };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = target;
  });
}

/**
 * Encode the loaded clip to `format` ('mp4' | 'webm'), invoking onProgress(0..1).
 * Runs off the live render loop: pauses playback, seeks each frame, and restores
 * position afterwards. Cancellable via state.exportCancel.
 */
export async function exportVideo(format, onProgress) {
  if (!state.loaded) { toast('Load a video first.'); return; }
  if (!isExportSupported()) { toast('Video export needs a browser with WebCodecs.'); return; }
  if (state.exporting) return;

  const duration = video.duration;
  if (!Number.isFinite(duration) || duration <= 0) { toast('Clip has no duration to export.'); return; }

  state.exporting = true;
  state.exportCancel = false;
  const wasPaused = video.paused;
  const prevTime = video.currentTime;
  video.pause();

  let encoder = null;
  try {
    const fps = Math.max(1, Math.round(state.settings.renderFps));

    // Render one frame to fix the output dimensions (rounded up to even — H.264
    // and VP9 encoders require even coded dimensions).
    await seekTo(0);
    resetTemporalState();
    processFrame();
    const width = canvas.width + (canvas.width % 2);
    const height = canvas.height + (canvas.height % 2);

    const encCanvas = document.createElement('canvas');
    encCanvas.width = width;
    encCanvas.height = height;
    const encCtx = encCanvas.getContext('2d', { alpha: false });

    const bitrate = Math.min(25_000_000, Math.max(2_000_000, Math.round(width * height * fps * 0.25)));
    const baseConfig = { width, height, bitrate, framerate: fps };

    let muxer, filename, mime;
    if (format === 'mp4') {
      const codec = await pickCodec(H264_CANDIDATES, baseConfig);
      if (!codec) throw new Error('No H.264 encoder available in this browser.');
      muxer = new Mp4Muxer({
        target: new Mp4Target(),
        video: { codec: 'avc', width, height },
        fastStart: 'in-memory'
      });
      filename = 'ascii-video.mp4';
      mime = 'video/mp4';
      baseConfig.codec = codec;
      baseConfig.avc = { format: 'avc' };
    } else {
      const codec = await pickCodec(VP9_CANDIDATES, baseConfig);
      if (!codec) throw new Error('No VP9 encoder available in this browser.');
      muxer = new WebmMuxer({
        target: new WebmTarget(),
        video: { codec: 'V_VP9', width, height, frameRate: fps }
      });
      filename = 'ascii-video.webm';
      mime = 'video/webm';
      baseConfig.codec = codec;
    }

    let encodeError = null;
    encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => { encodeError = e; }
    });
    encoder.configure({ ...baseConfig, latencyMode: 'quality' });

    const totalFrames = Math.max(1, Math.floor(duration * fps));
    const frameDurUs = Math.round(1_000_000 / fps);
    const keyEvery = fps * 2; // keyframe every ~2s for scrubbable output

    for (let i = 0; i < totalFrames; i++) {
      if (state.exportCancel) throw new Error('cancelled');
      if (encodeError) throw encodeError;

      await seekTo(i / fps);
      processFrame();
      encCtx.fillStyle = state.settings.backgroundColor;
      encCtx.fillRect(0, 0, width, height);
      encCtx.drawImage(canvas, 0, 0);

      const frame = new VideoFrame(encCanvas, { timestamp: i * frameDurUs, duration: frameDurUs });
      encoder.encode(frame, { keyFrame: i % keyEvery === 0 });
      frame.close();

      // Backpressure: don't outrun the encoder's queue.
      while (encoder.encodeQueueSize > 8) {
        await new Promise((r) => setTimeout(r, 4));
        if (encodeError) throw encodeError;
      }
      onProgress?.((i + 1) / totalFrames);
    }

    await encoder.flush();
    if (encodeError) throw encodeError;
    muxer.finalize();

    downloadBlob(new Blob([muxer.target.buffer], { type: mime }), filename);
    toast(`${format.toUpperCase()} export ready.`);
  } catch (err) {
    if (err && err.message === 'cancelled') toast('Export cancelled.');
    else { console.error(err); toast(`Export failed: ${err?.message || err}`); }
  } finally {
    try { if (encoder && encoder.state !== 'closed') encoder.close(); } catch { /* already closed */ }
    state.exporting = false;
    // Restore the preview to where the user left it.
    resetTemporalState();
    await seekTo(prevTime);
    processFrame();
    if (!wasPaused) video.play().catch(() => {});
  }
}
