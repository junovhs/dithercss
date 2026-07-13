// Control panel wiring: builds sliders/preset cards from the specs, keeps the
// `state.settings` object in sync with the DOM, and drives transport + auto-tune.

import { state, controlSpecs, defaults, presets } from './state.js';
import { $, video, sourceCanvas, sourceCtx } from './dom.js';
import { clamp, toast, escapeHtml, formatTime } from './util.js';
import { resetTemporalState, rebuildGlyphBank, processFrame } from './engine.js';

export function buildControls(targetId, specs) {
  const target = $(targetId);
  specs.forEach(([id, label, min, max, step, value, suffix]) => {
    const row = document.createElement('label');
    row.className = 'control-row';
    row.innerHTML = `<span>${label}</span><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"><output id="${id}Out"></output>`;
    target.appendChild(row);
    const input = $(id);
    input.addEventListener('input', () => {
      state.settings[id] = Number(input.value);
      updateOutput(id, suffix);
      state.activePreset = '';
      updatePresetSelection();
      if (['fontSize', 'charAspect', 'columns'].includes(id)) resetTemporalState();
    });
    input.addEventListener('change', () => {
      if (['fontSize', 'fontFamily'].includes(id)) rebuildGlyphBank();
    });
    updateOutput(id, suffix);
  });
}

export function updateOutput(id, suffix = '') {
  const input = $(id);
  const out = $(id + 'Out');
  const value = Number(input.value);
  out.textContent = `${Number.isInteger(value) ? value : value.toFixed(2)}${suffix}`;
}

export function buildPresetCards() {
  const grid = $('presetGrid');
  grid.innerHTML = '';
  const all = { ...presets, ...loadCustomPresets() };
  Object.entries(all).forEach(([key, preset]) => {
    const button = document.createElement('button');
    button.className = 'preset-card';
    button.dataset.preset = key;
    button.innerHTML = `<span class="preset-name">${escapeHtml(preset.name)}</span><span class="preset-note">${escapeHtml(preset.note || 'Saved custom look')}</span>`;
    button.addEventListener('click', () => applyPreset(key, preset));
    grid.appendChild(button);
  });
  updatePresetSelection();
}

export function loadCustomPresets() {
  try { return JSON.parse(localStorage.getItem('asciiVideoCustomPresets') || '{}'); }
  catch { return {}; }
}

export function saveCustomPresets(data) {
  localStorage.setItem('asciiVideoCustomPresets', JSON.stringify(data));
}

export function saveCurrentPreset() {
  const name = $('customPresetName').value.trim();
  if (!name) return toast('Give the preset a name first.');
  const custom = loadCustomPresets();
  const key = `custom-${Date.now()}`;
  custom[key] = { name, note: 'Custom saved look', values: { ...state.settings } };
  saveCustomPresets(custom);
  $('customPresetName').value = '';
  state.activePreset = key;
  buildPresetCards();
  toast(`Saved “${name}”.`);
}

export function applyPreset(key, preset) {
  state.activePreset = key;
  setSettings(preset.values);
  updatePresetSelection();
  toast(`${preset.name} applied.`);
}

export function updatePresetSelection() {
  document.querySelectorAll('.preset-card').forEach((card) => card.classList.toggle('active', card.dataset.preset === state.activePreset));
}

export function setSettings(values) {
  Object.entries({ ...defaults, ...values }).forEach(([key, value]) => {
    state.settings[key] = value;
    const el = $(key);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = Boolean(value);
    else el.value = value;
  });
  Object.values(controlSpecs).flat().forEach(([id, , , , , , suffix]) => updateOutput(id, suffix));
  $('customGlyphRow').classList.toggle('is-hidden', state.settings.glyphSet !== 'custom');
  resetTemporalState();
  rebuildGlyphBank();
}

export function syncSimpleControl(id, transform = (v) => v) {
  $(id).addEventListener('input', (event) => {
    state.settings[id] = transform(event.target.type === 'checkbox' ? event.target.checked : event.target.value);
    state.activePreset = '';
    updatePresetSelection();
    if (['glyphSet', 'customGlyphs', 'fontFamily'].includes(id)) rebuildGlyphBank();
    if (id === 'glyphSet') $('customGlyphRow').classList.toggle('is-hidden', event.target.value !== 'custom');
    if (['glyphSet', 'customGlyphs', 'fontFamily', 'invert'].includes(id)) resetTemporalState();
  });
}

export function handleFile(file) {
  if (!file || (!file.type.startsWith('video/') && !/\.(mp4|webm|mov|m4v|ogv|avi)$/i.test(file.name))) return toast('Choose a video file.');
  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  state.objectUrl = URL.createObjectURL(file);
  video.src = state.objectUrl;
  video.load();
  $('dropZone').classList.add('is-hidden');
  $('playerArea').classList.remove('is-hidden');
  state.loaded = true;
  resetTemporalState();
  toast(`${file.name} loaded.`);
}

export function updateTransport() {
  if (!Number.isFinite(video.duration)) return;
  $('timeline').value = video.duration ? Math.round((video.currentTime / video.duration) * 1000) : 0;
  $('currentTime').textContent = formatTime(video.currentTime);
  $('duration').textContent = formatTime(video.duration);
  $('playPause').textContent = video.paused ? '▶' : '❚❚';
}

export function autoTune() {
  if (!state.loaded || video.readyState < 2) return toast('Load a video first.');
  const sampleW = 64;
  const sampleH = Math.max(24, Math.round(sampleW * video.videoHeight / video.videoWidth));
  sourceCanvas.width = sampleW; sourceCanvas.height = sampleH;
  sourceCtx.drawImage(video, 0, 0, sampleW, sampleH);
  const data = sourceCtx.getImageData(0, 0, sampleW, sampleH).data;
  let sum = 0, sumSq = 0, edge = 0;
  const lumas = new Float32Array(sampleW * sampleH);
  for (let i = 0; i < lumas.length; i++) {
    const l = (.2126 * data[i * 4] + .7152 * data[i * 4 + 1] + .0722 * data[i * 4 + 2]) / 255;
    lumas[i] = l; sum += l; sumSq += l * l;
  }
  for (let y = 1; y < sampleH; y++) for (let x = 1; x < sampleW; x++) {
    const i = y * sampleW + x;
    edge += Math.abs(lumas[i] - lumas[i - 1]) + Math.abs(lumas[i] - lumas[i - sampleW]);
  }
  const mean = sum / lumas.length;
  const variance = Math.max(0, sumSq / lumas.length - mean * mean);
  const avgEdge = edge / lumas.length;
  setSettings({
    ...state.settings,
    columns: clamp(Math.round(96 + avgEdge * 190), 84, 168),
    contrast: clamp(1.08 + (0.08 - variance) * 3.2, .9, 1.8),
    brightness: clamp(.45 - mean, -.15, .15),
    gamma: clamp(.88 + (mean - .5) * .35, .68, 1.08),
    edgeStrength: clamp(.58 + avgEdge * 5, .55, 1.6),
    edgeThreshold: clamp(.36 - avgEdge * .8, .16, .34),
    dither: clamp(.08 + (0.09 - variance) * 1.6, .05, .48),
    temporal: .58,
    glyphHold: .3
  });
  state.activePreset = '';
  updatePresetSelection();
  toast('Auto-tuned for the current frame.');
}
