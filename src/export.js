// Single-frame export: PNG/TXT/HTML capture the current ASCII frame.
// Clip export (MP4/WebM) lives in encoder.js (WebCodecs).

import { state } from './state.js';
import { canvas } from './dom.js';
import { toast, downloadBlob, escapeHtml } from './util.js';
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
