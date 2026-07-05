/** An RGB triple with 0–255 channels. */
export type Rgb = [number, number, number];

/** Parse a `#rgb` or `#rrggbb` hex string into an {@link Rgb} triple. */
export function parseHexColor(value: string): Rgb {
  const hex = String(value).trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return [...hex].map((c) => Number.parseInt(c + c, 16)) as Rgb;
  }
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return [0, 2, 4].map((start) =>
      Number.parseInt(hex.slice(start, start + 2), 16),
    ) as Rgb;
  }
  throw new TypeError(`Invalid hex color: ${value}`);
}

/** Parse a whitespace/comma/semicolon-separated hex list into a palette. */
export function parsePalette(value: string): Rgb[] {
  const colors = String(value)
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map(parseHexColor);
  if (colors.length < 2) {
    throw new RangeError("A palette needs at least two valid hex colors.");
  }
  return colors;
}

/**
 * Apply saturation, contrast, and gamma to a 0–255 RGB pixel, returning a
 * normalized 0–1 RGB triple.
 */
export function shapeRgb(
  r: number,
  g: number,
  b: number,
  contrast: number,
  saturation: number,
  gamma: number,
): [number, number, number] {
  let nr = r / 255;
  let ng = g / 255;
  let nb = b / 255;
  const luma = 0.2126 * nr + 0.7152 * ng + 0.0722 * nb;
  nr = luma + (nr - luma) * saturation;
  ng = luma + (ng - luma) * saturation;
  nb = luma + (nb - luma) * saturation;
  nr = clamp01((nr - 0.5) * contrast + 0.5);
  ng = clamp01((ng - 0.5) * contrast + 0.5);
  nb = clamp01((nb - 0.5) * contrast + 0.5);
  nr = Math.pow(nr, gamma);
  ng = Math.pow(ng, gamma);
  nb = Math.pow(nb, gamma);
  return [nr, ng, nb];
}

/** Nearest palette color to `(r,g,b)` by squared Euclidean distance. */
export function nearestColor(
  r: number,
  g: number,
  b: number,
  palette: Rgb[],
): Rgb {
  let best = palette[0];
  let bestDistance = Infinity;
  for (const color of palette) {
    const dr = r - color[0];
    const dg = g - color[1];
    const db = b - color[2];
    const distance = dr * dr + dg * dg + db * db;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = color;
    }
  }
  return best;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
