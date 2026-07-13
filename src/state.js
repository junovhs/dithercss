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
  mapping: [
    ['columns', 'Columns', 40, 240, 1, 112, ''],
    ['fontSize', 'Render size', 7, 22, 1, 11, 'px'],
    ['charAspect', 'Cell aspect', 0.38, 0.78, 0.01, 0.58, ''],
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
  crisp: { name: 'Crisp Detail', note: 'Clean edges, balanced color', values: { ...defaults, columns: 130, edgeStrength: 1.05, edgeThreshold: .24, dither: .12, temporal: .58, glyphHold: .28 } },
  terminal: { name: 'Classic Terminal', note: 'High-contrast monochrome', values: { ...defaults, colorMode: 'mono', columns: 116, contrast: 1.42, gamma: .82, edgeStrength: .75, dither: .18, monoColor: '#eaf2ee', backgroundColor: '#020403' } },
  matrix: { name: 'Matrix Rain', note: 'Green phosphor glow', values: { ...defaults, glyphSet: 'dense', colorMode: 'matrix', columns: 128, contrast: 1.55, gamma: .72, edgeStrength: .9, glow: 7, scanlines: .22, backgroundColor: '#000703' } },
  amber: { name: 'Amber CRT', note: 'Warm vintage display', values: { ...defaults, colorMode: 'amber', columns: 108, contrast: 1.35, gamma: .86, dither: .32, glow: 5, scanlines: .32, backgroundColor: '#080400' } },
  blueprint: { name: 'Cyber Cyan', note: 'Cool technical linework', values: { ...defaults, colorMode: 'cyan', glyphSet: 'minimal', columns: 148, edgeStrength: 1.75, edgeThreshold: .2, contrast: 1.15, gamma: .92, dither: .08, glow: 4, backgroundColor: '#01070b' } },
  poster: { name: 'Posterized ANSI', note: 'Chunky 16-color texture', values: { ...defaults, colorMode: 'ansi', glyphSet: 'blocks', columns: 92, contrast: 1.5, gamma: .75, edgeStrength: .45, dither: .72, paletteSteps: 8, temporal: .66 } },
  noir: { name: 'Noir Dither', note: 'Graphic black-and-white', values: { ...defaults, colorMode: 'mono', glyphSet: 'dense', columns: 142, contrast: 2.05, gamma: .6, brightness: -.06, edgeStrength: 1.15, dither: 1.05, monoColor: '#ffffff', backgroundColor: '#000000' } },
  soft: { name: 'Soft Motion', note: 'Stable, low-flicker output', values: { ...defaults, columns: 104, edgeStrength: .38, dither: .08, temporal: .82, glyphHold: .68, renderFps: 18 } }
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
  activePreset: 'crisp',
  objectUrl: null
};
