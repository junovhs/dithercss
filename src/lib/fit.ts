/** A positioned, sized rectangle. */
export interface FitRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Contain/letterbox `src` inside `dst`, preserving aspect ratio and centering,
 * then magnify by `scale` (>=1) about the center. Parts past the destination
 * edges are meant to be clipped by the caller (canvas bounds).
 */
export function containRect(
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number,
  scale = 1,
): FitRect {
  if (srcWidth <= 0 || srcHeight <= 0) {
    return { x: 0, y: 0, width: dstWidth, height: dstHeight };
  }
  const fit = Math.min(dstWidth / srcWidth, dstHeight / srcHeight) * Math.max(1, scale);
  const width = srcWidth * fit;
  const height = srcHeight * fit;
  return {
    x: (dstWidth - width) / 2,
    y: (dstHeight - height) / 2,
    width,
    height,
  };
}
