/** Output color mode for the dither pass (matches the `#mode` select values). */
export type DitherMode = "rgb" | "gray" | "mono" | "palette";

/** What kind of source is currently loaded. */
export type SourceType = "html" | "image" | "video";

/** Valid Bayer matrix sizes (side length). */
export type BayerSize = 2 | 4 | 8 | 16;

/**
 * Full set of tuning knobs read by {@link ditherImageData}. Mirrors the object
 * produced by `currentDitherOptions()` in the original single-file app.
 */
export interface DitherOptions {
  mode: DitherMode;
  matrixSize: BayerSize;
  levels: number;
  strength: number;
  bias: number;
  patternScale: number;
  pixelSize: number;
  gamma: number;
  contrast: number;
  saturation: number;
  /** Dark endpoint hex for `mono` mode. */
  dark: string;
  /** Light endpoint hex for `mono` mode. */
  light: string;
  /** Whitespace/comma-separated hex list for `palette` mode. */
  palette: string;
  /** Keep source alpha; when false, composite over `matte`. */
  preserveAlpha: boolean;
  /** Background hex used when `preserveAlpha` is false. */
  matte: string;
}

/** Capture/output frame geometry. */
export interface Dimensions {
  width: number;
  height: number;
}
