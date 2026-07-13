// The ASCII render pipeline: sample the video frame, tone-map it, detect edges,
// dither, pick glyphs (with temporal stabilisation), and paint the output canvas.

import { state, glyphSets, ansiPalette } from './state.js';
import { video, canvas, ctx, sourceCanvas, sourceCtx, glyphCanvas, glyphCtx } from './dom.js';
import { clamp, rgbToHex } from './util.js';

export function activeGlyphString() {
  const raw = state.settings.glyphSet === 'custom' ? state.settings.customGlyphs : glyphSets[state.settings.glyphSet];
  return [...new Set(Array.from(raw || ' .:-=+*#%@'))].join('');
}

export function rebuildGlyphBank() {
  const chars = Array.from(activeGlyphString());
  const fontSize = 48;
  const fontFamily = state.settings.fontFamily;
  glyphCanvas.width = 64;
  glyphCanvas.height = 64;
  glyphCtx.textAlign = 'center';
  glyphCtx.textBaseline = 'middle';
  glyphCtx.font = `${fontSize}px ${fontFamily}`;
  const bank = chars.map((char) => {
    glyphCtx.fillStyle = '#000';
    glyphCtx.fillRect(0, 0, glyphCanvas.width, glyphCanvas.height);
    glyphCtx.fillStyle = '#fff';
    glyphCtx.fillText(char, glyphCanvas.width / 2, glyphCanvas.height / 2 + 1);
    const data = glyphCtx.getImageData(0, 0, glyphCanvas.width, glyphCanvas.height).data;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) sum += data[i] / 255;
    return { char, density: sum / (glyphCanvas.width * glyphCanvas.height) };
  }).sort((a, b) => a.density - b.density);

  const min = bank[0]?.density || 0;
  const max = bank[bank.length - 1]?.density || 1;
  state.glyphBank = bank.map((g) => ({ ...g, normalized: (g.density - min) / Math.max(.00001, max - min) }));
}

export function resetTemporalState() {
  state.previousLuma = null;
  state.previousGlyphIndices = null;
}

export function frameDimensions() {
  const cols = Math.max(10, Math.round(state.settings.columns));
  const ratio = video.videoWidth && video.videoHeight ? video.videoHeight / video.videoWidth : 9 / 16;
  const rows = Math.max(8, Math.round(cols * state.settings.charAspect * ratio));
  return { cols, rows };
}

export function processFrame() {
  if (!state.loaded || video.readyState < 2 || !video.videoWidth) return;
  const { cols, rows } = frameDimensions();
  if (sourceCanvas.width !== cols || sourceCanvas.height !== rows) {
    sourceCanvas.width = cols;
    sourceCanvas.height = rows;
    resetTemporalState();
  }

  sourceCtx.drawImage(video, 0, 0, cols, rows);
  const image = sourceCtx.getImageData(0, 0, cols, rows);
  const px = image.data;
  const count = cols * rows;
  const currentLuma = new Float32Array(count);
  const reds = new Uint8Array(count);
  const greens = new Uint8Array(count);
  const blues = new Uint8Array(count);

  const sat = state.settings.saturation;
  const colorBoost = state.settings.colorBoost;
  for (let i = 0; i < count; i++) {
    let r = px[i * 4];
    let g = px[i * 4 + 1];
    let b = px[i * 4 + 2];
    const l = .2126 * r + .7152 * g + .0722 * b;
    r = clamp(l + (r - l) * sat, 0, 255) * colorBoost;
    g = clamp(l + (g - l) * sat, 0, 255) * colorBoost;
    b = clamp(l + (b - l) * sat, 0, 255) * colorBoost;
    reds[i] = clamp(Math.round(r), 0, 255);
    greens[i] = clamp(Math.round(g), 0, 255);
    blues[i] = clamp(Math.round(b), 0, 255);
    currentLuma[i] = l / 255;
  }

  const temporal = state.settings.temporal;
  const luma = new Float32Array(count);
  if (state.previousLuma && state.previousLuma.length === count) {
    for (let i = 0; i < count; i++) luma[i] = currentLuma[i] * (1 - temporal) + state.previousLuma[i] * temporal;
  } else {
    luma.set(currentLuma);
  }
  state.previousLuma = luma.slice();

  const adjusted = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let v = (luma[i] - .5) * state.settings.contrast + .5 + state.settings.brightness;
    v = Math.pow(clamp(v, 0, 1), Math.max(.05, state.settings.gamma));
    adjusted[i] = state.settings.invert ? 1 - v : v;
  }

  const gx = new Float32Array(count);
  const gy = new Float32Array(count);
  const edge = new Float32Array(count);
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      const i = y * cols + x;
      const tl = adjusted[i - cols - 1], tc = adjusted[i - cols], tr = adjusted[i - cols + 1];
      const ml = adjusted[i - 1], mr = adjusted[i + 1];
      const bl = adjusted[i + cols - 1], bc = adjusted[i + cols], br = adjusted[i + cols + 1];
      gx[i] = -tl - 2 * ml - bl + tr + 2 * mr + br;
      gy[i] = -tl - 2 * tc - tr + bl + 2 * bc + br;
      edge[i] = Math.min(1.5, Math.hypot(gx[i], gy[i]));
    }
  }

  const working = adjusted.slice();
  if (state.settings.dither > 0) applyDither(working, cols, rows, state.settings.dither, state.glyphBank.length);

  const glyphIndices = new Int16Array(count);
  const chars = new Array(count);
  const colors = new Array(count);
  const hold = state.settings.glyphHold;

  for (let i = 0; i < count; i++) {
    const edgeAmount = edge[i];
    let tone = clamp(working[i] + edgeAmount * .12 * state.settings.edgeStrength, 0, 1);
    let index = nearestGlyphIndex(tone);

    if (state.settings.directionalEdges && edgeAmount * state.settings.edgeStrength > state.settings.edgeThreshold) {
      const edgeChar = directionChar(gx[i], gy[i]);
      const exact = state.glyphBank.findIndex((entry) => entry.char === edgeChar);
      if (exact >= 0) index = exact;
      else chars[i] = edgeChar;
    }

    if (state.previousGlyphIndices && state.previousGlyphIndices.length === count && hold > 0) {
      const previous = state.previousGlyphIndices[i];
      const delta = Math.abs(previous - index);
      const lockRange = Math.max(1, Math.ceil(state.glyphBank.length * hold * .18));
      if (delta <= lockRange) index = previous;
      else index = Math.round(index * (1 - hold * .55) + previous * hold * .55);
    }

    glyphIndices[i] = index;
    if (!chars[i]) chars[i] = state.glyphBank[index]?.char || ' ';
    colors[i] = mappedColor(reds[i], greens[i], blues[i], adjusted[i]);
  }
  state.previousGlyphIndices = glyphIndices;
  state.currentAscii = rowsToText(chars, cols, rows);
  state.currentColors = colors;
  renderAscii(chars, colors, cols, rows);
}

function applyDither(values, cols, rows, strength, levels) {
  const denominator = Math.max(1, levels - 1);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const oldValue = values[i];
      const newValue = Math.round(oldValue * denominator) / denominator;
      const error = (oldValue - newValue) * strength;
      values[i] = newValue;
      distribute(values, cols, rows, x + 1, y, error * 7 / 16);
      distribute(values, cols, rows, x - 1, y + 1, error * 3 / 16);
      distribute(values, cols, rows, x, y + 1, error * 5 / 16);
      distribute(values, cols, rows, x + 1, y + 1, error * 1 / 16);
    }
  }
}

function distribute(values, cols, rows, x, y, value) {
  if (x < 0 || y < 0 || x >= cols || y >= rows) return;
  const i = y * cols + x;
  values[i] = clamp(values[i] + value, 0, 1);
}

function nearestGlyphIndex(value) {
  let best = 0;
  let distance = Infinity;
  for (let i = 0; i < state.glyphBank.length; i++) {
    const d = Math.abs(state.glyphBank[i].normalized - value);
    if (d < distance) { distance = d; best = i; }
  }
  return best;
}

function directionChar(x, y) {
  const angle = Math.atan2(y, x);
  const pi = Math.PI;
  if (angle > -pi / 8 && angle <= pi / 8) return '|';
  if (angle > pi / 8 && angle <= 3 * pi / 8) return '/';
  if (angle > 3 * pi / 8 && angle <= 5 * pi / 8) return '-';
  if (angle > 5 * pi / 8 && angle <= 7 * pi / 8) return '\\';
  if (angle <= -7 * pi / 8 || angle > 7 * pi / 8) return '|';
  if (angle > -7 * pi / 8 && angle <= -5 * pi / 8) return '/';
  if (angle > -5 * pi / 8 && angle <= -3 * pi / 8) return '-';
  return '\\';
}

function mappedColor(r, g, b, luminance) {
  const mode = state.settings.colorMode;
  if (mode === 'mono') return state.settings.monoColor;
  if (mode === 'matrix') return rgbToHex(0, 55 + luminance * 200, 45 + luminance * 90);
  if (mode === 'amber') return rgbToHex(80 + luminance * 175, 28 + luminance * 125, 0);
  if (mode === 'cyan') return rgbToHex(0, 85 + luminance * 150, 110 + luminance * 145);
  if (mode === 'ansi') {
    let best = ansiPalette[0];
    let dist = Infinity;
    for (const c of ansiPalette) {
      const d = (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2;
      if (d < dist) { dist = d; best = c; }
    }
    return rgbToHex(best[0], best[1], best[2]);
  }
  const steps = Math.max(2, state.settings.paletteSteps);
  const q = (v) => Math.round((v / 255) * (steps - 1)) * 255 / (steps - 1);
  return rgbToHex(q(r), q(g), q(b));
}

export function renderAscii(chars, colors, cols, rows) {
  const fontSize = Math.round(state.settings.fontSize);
  const cellHeight = Math.max(7, Math.round(fontSize * 1.05));
  const cellWidth = Math.max(4, Math.round(cellHeight * state.settings.charAspect));
  const width = cols * cellWidth;
  const height = rows * cellHeight;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  ctx.save();
  ctx.fillStyle = state.settings.backgroundColor;
  ctx.fillRect(0, 0, width, height);
  ctx.font = `${fontSize}px ${state.settings.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowBlur = state.settings.glow;
  ctx.shadowColor = colors[Math.floor(colors.length / 2)] || state.settings.monoColor;

  if (state.settings.colorMode === 'mono' && state.settings.glow === 0) {
    ctx.fillStyle = state.settings.monoColor;
    ctx.textAlign = 'left';
    for (let y = 0; y < rows; y++) {
      const line = chars.slice(y * cols, (y + 1) * cols).join('');
      ctx.fillText(line, 0, y * cellHeight + cellHeight / 2);
    }
  } else {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        ctx.fillStyle = colors[i];
        ctx.shadowColor = colors[i];
        ctx.fillText(chars[i], x * cellWidth + cellWidth / 2, y * cellHeight + cellHeight / 2);
      }
    }
  }

  if (state.settings.scanlines > 0) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(0,0,0,${state.settings.scanlines})`;
    for (let y = 1; y < height; y += Math.max(2, cellHeight)) ctx.fillRect(0, y, width, 1);
  }
  ctx.restore();
}

export function rowsToText(chars, cols, rows) {
  const lines = [];
  for (let y = 0; y < rows; y++) lines.push(chars.slice(y * cols, (y + 1) * cols).join(''));
  return lines.join('\n');
}
