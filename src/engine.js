// The ASCII render pipeline: sample the video frame, tone-map it, detect edges,
// dither, pick glyphs (with temporal stabilisation), and paint the output canvas.

import { state, glyphSets, ansiPalette } from './state.js';
import { video, canvas, ctx, sourceCanvas, sourceCtx, glyphCanvas, glyphCtx } from './dom.js';
import { clamp, rgbToHex } from './util.js';

// Reused offscreen glyph layer for the glow path (allocated lazily).
let layerCanvas = null, layerCtx = null;

// Memoise rgb→'#rrggbb'. With quantised palettes the same few colours recur across
// thousands of cells, so this turns most per-cell string builds into a Map hit.
const hexMemo = new Map();
function hexOf(r, g, b) {
  r = clamp(Math.round(r), 0, 255); g = clamp(Math.round(g), 0, 255); b = clamp(Math.round(b), 0, 255);
  const key = (r << 16) | (g << 8) | b;
  let s = hexMemo.get(key);
  if (s === undefined) { s = rgbToHex(r, g, b); if (hexMemo.size < 100000) hexMemo.set(key, s); }
  return s;
}

// Draw the coloured glyphs onto `g`, batched by colour so fillStyle (a relatively
// expensive parse) changes a few hundred times per frame instead of once per cell.
// Glyphs are drawn in their own colour, so edges/overflow are coloured correctly.
function drawGlyphs(g, chars, colors, cols, rows, cellWidth, cellHeight, fontSize, fontFamily) {
  g.font = `${fontSize}px ${fontFamily}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const byColor = new Map();
  for (let i = 0, n = cols * rows; i < n; i++) {
    const ch = chars[i];
    if (!ch || ch === ' ') continue;
    let group = byColor.get(colors[i]);
    if (!group) { group = []; byColor.set(colors[i], group); }
    group.push(i);
  }
  for (const [color, group] of byColor) {
    g.fillStyle = color;
    for (let k = 0; k < group.length; k++) {
      const i = group[k];
      const x = i % cols, y = (i / cols) | 0;
      g.fillText(chars[i], x * cellWidth + cellWidth / 2, y * cellHeight + cellHeight / 2);
    }
  }
}

function drawScanlines(width, height, cellHeight) {
  if (state.settings.scanlines > 0) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(0,0,0,${state.settings.scanlines})`;
    for (let y = 1; y < height; y += Math.max(2, cellHeight)) ctx.fillRect(0, y, width, 1);
  }
}

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

  // Precompute a 256-entry tone→glyph LUT so processFrame does an O(1) lookup per
  // cell instead of scanning the whole bank per pixel.
  const lut = new Int16Array(256);
  const gb = state.glyphBank;
  for (let t = 0; t < 256; t++) {
    const v = t / 255;
    let best = 0, dist = Infinity;
    for (let i = 0; i < gb.length; i++) {
      const d = Math.abs(gb[i].normalized - v);
      if (d < dist) { dist = d; best = i; }
    }
    lut[t] = best;
  }
  state.glyphLUT = lut;
}

export function resetTemporalState() {
  state.previousLuma = null;
  state.previousGlyphIndices = null;
}

// The output is exactly `outputWidth` px wide; height follows the source aspect.
// The character grid is derived from the requested per-cell pixel sizes, so the
// user thinks in "pixels per column/row" and columns/rows fall out.
export function frameDimensions() {
  const s = state.settings;
  const outW = Math.max(16, Math.round(s.outputWidth));
  const ratio = video.videoWidth && video.videoHeight ? video.videoHeight / video.videoWidth : 9 / 16;
  const outH = Math.max(16, Math.round(outW * ratio));
  const cols = Math.max(2, Math.round(outW / Math.max(1, s.cellW)));
  const rows = Math.max(2, Math.round(outH / Math.max(1, s.cellH)));
  return { cols, rows, outW, outH };
}

// Exact render metrics: cells fill the output canvas precisely, and the glyph is
// auto-sized to fit its cell (0.6 ≈ monospace advance/height) so it always reads
// crisply at the chosen size, scaled by the glyphScale fine-tune.
export function glyphMetrics() {
  const { cols, rows, outW, outH } = frameDimensions();
  const cellWidth = outW / cols;
  const cellHeight = outH / rows;
  const fontSize = Math.max(4, Math.min(cellHeight, cellWidth / 0.6) * state.settings.glyphScale);
  return { cols, rows, outW, outH, cellWidth, cellHeight, fontSize };
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
      const ex = -tl - 2 * ml - bl + tr + 2 * mr + br;
      const ey = -tl - 2 * tc - tr + bl + 2 * bc + br;
      gx[i] = ex; gy[i] = ey;
      edge[i] = Math.min(1.5, Math.sqrt(ex * ex + ey * ey));
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
    let index = state.glyphLUT ? state.glyphLUT[(tone * 255) | 0] : 0;

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
  if (mode === 'matrix') return hexOf(0, 55 + luminance * 200, 45 + luminance * 90);
  if (mode === 'amber') return hexOf(80 + luminance * 175, 28 + luminance * 125, 0);
  if (mode === 'cyan') return hexOf(0, 85 + luminance * 150, 110 + luminance * 145);
  if (mode === 'ansi') {
    let best = ansiPalette[0];
    let dist = Infinity;
    for (const c of ansiPalette) {
      const d = (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2;
      if (d < dist) { dist = d; best = c; }
    }
    return hexOf(best[0], best[1], best[2]);
  }
  const steps = Math.max(2, state.settings.paletteSteps);
  const q = (v) => Math.round((v / 255) * (steps - 1)) * 255 / (steps - 1);
  return hexOf(q(r), q(g), q(b));
}

export function renderAscii(chars, colors, cols, rows) {
  const { outW, outH, cellWidth, cellHeight, fontSize } = glyphMetrics();
  const width = outW;
  const height = outH;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const fontFamily = state.settings.fontFamily;
  const glow = state.settings.glow;

  // Fast mono path: row-batched, no glow — unchanged.
  if (state.settings.colorMode === 'mono' && glow === 0) {
    ctx.save();
    ctx.fillStyle = state.settings.backgroundColor;
    ctx.fillRect(0, 0, width, height);
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = state.settings.monoColor;
    for (let y = 0; y < rows; y++) {
      const line = chars.slice(y * cols, (y + 1) * cols).join('');
      ctx.fillText(line, 0, y * cellHeight + cellHeight / 2);
    }
    drawScanlines(width, height, cellHeight);
    ctx.restore();
    return;
  }

  // Colored path. Glyphs are drawn in their own colour (batched), with no per-glyph
  // shadow. Glow, when on, is a single blurred pass of the whole glyph layer instead
  // of an expensive shadowBlur per cell.
  ctx.save();
  ctx.fillStyle = state.settings.backgroundColor;
  ctx.fillRect(0, 0, width, height);

  if (glow > 0) {
    if (!layerCanvas) { layerCanvas = document.createElement('canvas'); layerCtx = layerCanvas.getContext('2d'); }
    if (layerCanvas.width !== width || layerCanvas.height !== height) { layerCanvas.width = width; layerCanvas.height = height; }
    layerCtx.setTransform(1, 0, 0, 1, 0, 0);
    layerCtx.clearRect(0, 0, width, height);
    drawGlyphs(layerCtx, chars, colors, cols, rows, cellWidth, cellHeight, fontSize, fontFamily);
    // One blurred pass of the whole glyph layer (a soft coloured bloom) then the
    // sharp glyphs on top — replaces the old per-glyph shadowBlur (much cheaper).
    ctx.filter = `blur(${glow * 0.6}px)`;
    ctx.drawImage(layerCanvas, 0, 0);
    ctx.filter = 'none';
    ctx.drawImage(layerCanvas, 0, 0);
  } else {
    drawGlyphs(ctx, chars, colors, cols, rows, cellWidth, cellHeight, fontSize, fontFamily);
  }

  drawScanlines(width, height, cellHeight);
  ctx.restore();
}

export function rowsToText(chars, cols, rows) {
  const lines = [];
  for (let y = 0; y < rows; y++) lines.push(chars.slice(y * cols, (y + 1) * cols).join(''));
  return lines.join('\n');
}
