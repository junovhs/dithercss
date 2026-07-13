// Frame + clip export. PNG/TXT/HTML capture the current frame; the recorder uses
// MediaRecorder + canvas.captureStream for WebM. (The clip recorder is slated for
// replacement by a WebCodecs MP4/WebM engine — see issue EXPO-01.)

import { state } from './state.js';
import { canvas, video, $ } from './dom.js';
import { toast, downloadBlob, escapeHtml, formatTime } from './util.js';
import { frameDimensions } from './engine.js';

export function exportPng() {
  if (!state.loaded) return toast('Load a video first.');
  canvas.toBlob((blob) => blob && downloadBlob(blob, 'ascii-frame.png'), 'image/png');
}

export function exportText() {
  if (!state.currentAscii) return toast('Render a frame first.');
  downloadBlob(new Blob([state.currentAscii], { type: 'text/plain;charset=utf-8' }), 'ascii-frame.txt');
}

export function exportHtml() {
  if (!state.currentAscii) return toast('Render a frame first.');
  const { cols, rows } = frameDimensions();
  const lines = [];
  for (let y = 0; y < rows; y++) {
    let line = '';
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const char = state.currentAscii.split('\n')[y]?.[x] || ' ';
      line += `<span style="color:${state.currentColors[i] || state.settings.monoColor}">${escapeHtml(char)}</span>`;
    }
    lines.push(line);
  }
  const html = `<!doctype html><meta charset="utf-8"><title>ASCII frame</title><style>html,body{margin:0;background:${state.settings.backgroundColor};}pre{margin:0;padding:20px;font:${state.settings.fontSize}px/${Math.round(state.settings.fontSize * 1.05)}px ${state.settings.fontFamily};letter-spacing:0;white-space:pre;}</style><pre>${lines.join('\n')}</pre>`;
  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), 'ascii-frame.html');
}

export function toggleRecording() {
  if (state.recorder && state.recorder.state === 'recording') {
    state.recorder.stop();
    return;
  }
  if (!state.loaded) return toast('Load a video first.');
  if (!canvas.captureStream || !window.MediaRecorder) return toast('WebM recording is not supported in this browser.');
  const stream = canvas.captureStream(state.settings.renderFps);
  try {
    const videoStream = video.captureStream?.();
    const audioTrack = videoStream?.getAudioTracks?.()[0];
    if (audioTrack) stream.addTrack(audioTrack);
  } catch {}
  const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
  state.recordedChunks = [];
  state.recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 8_000_000 } : undefined);
  state.recorder.ondataavailable = (event) => { if (event.data.size) state.recordedChunks.push(event.data); };
  state.recorder.onstop = () => {
    downloadBlob(new Blob(state.recordedChunks, { type: state.recorder.mimeType || 'video/webm' }), 'ascii-video.webm');
    $('recordButton').classList.remove('recording');
    $('recordButton').textContent = 'Record WebM';
    $('recordStatus').textContent = '';
    toast('WebM export ready.');
  };
  state.recorder.start(500);
  state.recordingStartedAt = performance.now();
  $('recordButton').classList.add('recording');
  $('recordButton').textContent = 'Stop recording';
  if (video.paused) video.play().catch(() => {});
  const tick = () => {
    if (!state.recorder || state.recorder.state !== 'recording') return;
    $('recordStatus').textContent = `REC ${formatTime((performance.now() - state.recordingStartedAt) / 1000)}`;
    requestAnimationFrame(tick);
  };
  tick();
}
