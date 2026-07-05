import type { DitherOptions } from "../../types";
import { clamp } from "../util";
import { makeBayerMatrix } from "./bayerMatrix";
import { nearestColor, parseHexColor, parsePalette, shapeRgb } from "./color";
import { orderedQuantize } from "./quantize";

/** Default tuning, matching the control defaults of the original single-file app. */
export const DEFAULT_DITHER_OPTIONS: DitherOptions = {
  mode: "rgb",
  matrixSize: 8,
  levels: 4,
  strength: 1,
  bias: 0,
  patternScale: 1,
  pixelSize: 1,
  gamma: 1,
  contrast: 1,
  saturation: 1,
  dark: "#101018",
  light: "#f4f0ff",
  palette: "#101018 #394273 #7d70dc #f4f0ff",
  preserveAlpha: true,
  matte: "#ffffff",
};

/**
 * Apply ordered (Bayer) dithering to `imageData` in place. Mutates and returns
 * the same object. This is the pure heart of the pipeline — no DOM access.
 */
export function ditherImageData(
  imageData: ImageData,
  options: DitherOptions,
): ImageData {
  const matrix = makeBayerMatrix(options.matrixSize);
  const size = matrix.length;
  const denominator = size * size;
  const levels = clamp(Math.round(options.levels), 2, 32);
  const strength = clamp(options.strength, 0, 3);
  const bias = clamp(options.bias, -0.5, 0.5);
  const patternScale = Math.max(1, Math.round(options.patternScale));
  const gamma = clamp(options.gamma, 0.05, 5);
  const contrast = clamp(options.contrast, 0, 5);
  const saturation = clamp(options.saturation, 0, 5);
  const dark = parseHexColor(options.dark);
  const light = parseHexColor(options.light);
  const palette = parsePalette(options.palette);
  const data = imageData.data;

  for (let y = 0; y < imageData.height; y += 1) {
    const matrixY = Math.floor(y / patternScale) % size;
    for (let x = 0; x < imageData.width; x += 1) {
      const offset = (y * imageData.width + x) * 4;
      const alpha = data[offset + 3];
      if (alpha === 0) continue;
      const matrixX = Math.floor(x / patternScale) % size;
      const ordered = (matrix[matrixY][matrixX] + 0.5) / denominator;
      const threshold = clamp(0.5 + (ordered - 0.5) * strength + bias, 0, 1);
      const shaped = shapeRgb(
        data[offset],
        data[offset + 1],
        data[offset + 2],
        contrast,
        saturation,
        gamma,
      );

      if (options.mode === "gray" || options.mode === "mono") {
        const luma = 0.2126 * shaped[0] + 0.7152 * shaped[1] + 0.0722 * shaped[2];
        const value = orderedQuantize(
          luma,
          options.mode === "mono" ? 2 : levels,
          threshold,
        );
        if (options.mode === "mono") {
          data[offset] = Math.round(dark[0] + (light[0] - dark[0]) * value);
          data[offset + 1] = Math.round(dark[1] + (light[1] - dark[1]) * value);
          data[offset + 2] = Math.round(dark[2] + (light[2] - dark[2]) * value);
        } else {
          const channel = Math.round(Math.pow(value, 1 / gamma) * 255);
          data[offset] = channel;
          data[offset + 1] = channel;
          data[offset + 2] = channel;
        }
      } else if (options.mode === "palette") {
        const perturb =
          ((ordered - 0.5) * strength * 255) /
            Math.max(1, Math.cbrt(palette.length) - 1 || 1) +
          bias * 255;
        const chosen = nearestColor(
          clamp(shaped[0] * 255 + perturb, 0, 255),
          clamp(shaped[1] * 255 + perturb, 0, 255),
          clamp(shaped[2] * 255 + perturb, 0, 255),
          palette,
        );
        data[offset] = chosen[0];
        data[offset + 1] = chosen[1];
        data[offset + 2] = chosen[2];
      } else {
        data[offset] = Math.round(
          Math.pow(orderedQuantize(shaped[0], levels, threshold), 1 / gamma) * 255,
        );
        data[offset + 1] = Math.round(
          Math.pow(orderedQuantize(shaped[1], levels, threshold), 1 / gamma) * 255,
        );
        data[offset + 2] = Math.round(
          Math.pow(orderedQuantize(shaped[2], levels, threshold), 1 / gamma) * 255,
        );
      }
      if (!options.preserveAlpha) data[offset + 3] = 255;
    }
  }
  return imageData;
}
