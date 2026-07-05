import { clamp } from "../util";

/**
 * Ordered quantization of a normalized 0–1 `value` to `levels` steps, using the
 * Bayer-derived `threshold` to decide whether to round up within a step.
 */
export function orderedQuantize(
  value: number,
  levels: number,
  threshold: number,
): number {
  const scaled = clamp(value, 0, 1) * (levels - 1);
  const low = Math.floor(scaled);
  const fraction = scaled - low;
  const index = Math.min(levels - 1, low + (fraction >= threshold ? 1 : 0));
  return index / (levels - 1);
}
