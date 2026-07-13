// Shared DOM element references. This module is imported by everything that
// touches the page; because the app loads as `<script type="module">` (deferred),
// the DOM is fully parsed before any of these lookups run.

export const $ = (id) => document.getElementById(id);

export const video = $('sourceVideo');
export const canvas = $('asciiCanvas');
export const ctx = canvas.getContext('2d', { alpha: false });

// Offscreen scratch canvases: `source` samples the video down to the ASCII grid,
// `glyph` measures the ink density of each character for tone mapping.
export const sourceCanvas = $('sourceCanvas');
export const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
export const glyphCanvas = $('glyphCanvas');
export const glyphCtx = glyphCanvas.getContext('2d', { willReadFrequently: true });
