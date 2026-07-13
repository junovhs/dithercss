// Static configuration data (glyph sets, palettes, control specs, presets) plus
// the single mutable `state` object shared across the engine and UI.

export const glyphSets = {
  classic: ' .,:;irsXA253hMHGS#9B&@',
  dense: '  .`^",:;Il!i~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
  blocks: ' ░▒▓█',
  braille: ' ⠁⠂⠄⡀⢀⠈⠐⠠⠃⠅⠉⠘⠰⠿⣿',
  minimal: ' .-:=+*#%@'
};

export const ansiPalette = [
  [0, 0, 0], [128, 0, 0], [0, 128, 0], [128, 128, 0], [0, 0, 128], [128, 0, 128], [0, 128, 128], [192, 192, 192],
  [128, 128, 128], [255, 0, 0], [0, 255, 0], [255, 255, 0], [0, 0, 255], [255, 0, 255], [0, 255, 255], [255, 255, 255]
];

// [id, label, min, max, step, default, suffix]
export const controlSpecs = {
  size: [
    ['outputWidth', 'Output width', 128, 2048, 8, 512, 'px'],
    ['cellW', 'Column size', 2, 24, 0.5, 3.5, 'px'],
    ['cellH', 'Row size', 3, 40, 0.5, 7, 'px'],
    ['glyphScale', 'Glyph size', 0.5, 1.2, 0.01, 1, '×']
  ],
  mapping: [
    ['contrast', 'Contrast', 0.3, 2.5, 0.01, 1.15, '×'],
    ['gamma', 'Gamma', 0.35, 2.6, 0.01, 0.95, ''],
    ['brightness', 'Brightness', -0.5, 0.5, 0.01, 0, ''],
    ['edgeStrength', 'Edge boost', 0, 2.5, 0.01, 0.65, ''],
    ['edgeThreshold', 'Edge threshold', 0.05, 1.2, 0.01, 0.28, ''],
    ['dither', 'Dither', 0, 1.5, 0.01, 0.22, '']
  ],
  image: [
    ['saturation', 'Saturation', 0, 2.5, 0.01, 1.15, '×'],
    ['colorBoost', 'Color brightness', 0.35, 2.2, 0.01, 1.08, '×'],
    ['paletteSteps', 'Palette steps', 2, 32, 1, 16, ''],
    ['scanlines', 'Scanlines', 0, 0.8, 0.01, 0.08, ''],
    ['glow', 'Glow', 0, 18, 1, 2, 'px']
  ],
  motion: [
    ['temporal', 'Temporal smoothing', 0, 0.92, 0.01, 0.52, ''],
    ['glyphHold', 'Glyph stability', 0, 0.85, 0.01, 0.22, ''],
    ['renderFps', 'Preview FPS', 6, 30, 1, 20, ' fps']
  ]
};

export const defaults = {};
Object.values(controlSpecs).flat().forEach(([id, , , , , def]) => { defaults[id] = def; });
Object.assign(defaults, {
  glyphSet: 'classic', customGlyphs: ' .:-=+*#%@', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  directionalEdges: true, invert: false, colorMode: 'source', backgroundColor: '#05070a', monoColor: '#f5f7fa', resetOnSeek: true
});

export const presets = {
  default: { name: 'Default', note: 'Loads on start', values: { ...defaults, outputWidth: 512, cellW: 3.5, cellH: 7, glyphScale: 1, contrast: .6, gamma: .73, brightness: .03, edgeStrength: 1.15, edgeThreshold: .05, dither: 0, directionalEdges: false, invert: false, colorMode: 'source', saturation: 1.72, colorBoost: 1.66, paletteSteps: 8, scanlines: 0, glow: 4, temporal: 0, glyphHold: 0, renderFps: 20, resetOnSeek: false } },
  crisp: { name: 'Crisp Detail', note: 'Clean edges, balanced color', values: { ...defaults, outputWidth: 640, cellW: 5, cellH: 8.5, edgeStrength: 1.05, edgeThreshold: .24, dither: .12, temporal: .58, glyphHold: .28 } },
  terminal: { name: 'Classic Terminal', note: 'High-contrast monochrome', values: { ...defaults, outputWidth: 640, cellW: 5.5, cellH: 9.5, colorMode: 'mono', contrast: 1.42, gamma: .82, edgeStrength: .75, dither: .18, monoColor: '#eaf2ee', backgroundColor: '#020403' } },
  matrix: { name: 'Matrix Rain', note: 'Green phosphor glow', values: { ...defaults, outputWidth: 640, cellW: 5, cellH: 8.5, glyphSet: 'dense', colorMode: 'matrix', contrast: 1.55, gamma: .72, edgeStrength: .9, glow: 7, scanlines: .22, backgroundColor: '#000703' } },
  amber: { name: 'Amber CRT', note: 'Warm vintage display', values: { ...defaults, outputWidth: 640, cellW: 6, cellH: 10.5, colorMode: 'amber', contrast: 1.35, gamma: .86, dither: .32, glow: 5, scanlines: .32, backgroundColor: '#080400' } },
  blueprint: { name: 'Cyber Cyan', note: 'Cool technical linework', values: { ...defaults, outputWidth: 640, cellW: 4.5, cellH: 7.5, colorMode: 'cyan', glyphSet: 'minimal', edgeStrength: 1.75, edgeThreshold: .2, contrast: 1.15, gamma: .92, dither: .08, glow: 4, backgroundColor: '#01070b' } },
  poster: { name: 'Posterized ANSI', note: 'Chunky 16-color texture', values: { ...defaults, outputWidth: 640, cellW: 7, cellH: 12, colorMode: 'ansi', glyphSet: 'blocks', contrast: 1.5, gamma: .75, edgeStrength: .45, dither: .72, paletteSteps: 8, temporal: .66 } },
  noir: { name: 'Noir Dither', note: 'Graphic black-and-white', values: { ...defaults, outputWidth: 640, cellW: 4.5, cellH: 7.5, colorMode: 'mono', glyphSet: 'dense', contrast: 2.05, gamma: .6, brightness: -.06, edgeStrength: 1.15, dither: 1.05, monoColor: '#ffffff', backgroundColor: '#000000' } },
  soft: { name: 'Soft Motion', note: 'Stable, low-flicker output', values: { ...defaults, outputWidth: 640, cellW: 6, cellH: 10.5, edgeStrength: .38, dither: .08, temporal: .82, glyphHold: .68, renderFps: 18 } }
};

export const state = {
  settings: { ...defaults },
  glyphBank: [],
  previousLuma: null,
  previousGlyphIndices: null,
  lastFrameTime: 0,
  animationId: 0,
  loaded: false,
  currentAscii: '',
  currentColors: [],
  exporting: false,
  exportCancel: false,
  activePreset: 'default',
  objectUrl: null
};
