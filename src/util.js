// Pure helpers plus the toast + download side-effect utilities. No app state.

import { $ } from './dom.js';

export function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

export function componentToHex(value) {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
}

export function rgbToHex(r, g, b) {
  return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[ch]));
}

export function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '00:00';
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

let toastTimer;
export function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}
