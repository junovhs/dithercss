import { describe, expect, it } from "vitest";

import { DEFAULT_DITHER_OPTIONS, ditherImageData } from "./ditherImageData";
import type { DitherOptions } from "../../types";

/** Build a fake ImageData (no DOM) filled by a per-pixel function. */
function makeImage(
  width: number,
  height: number,
  fill: (index: number) => [number, number, number, number],
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    const [r, g, b, a] = fill(p);
    data.set([r, g, b, a], p * 4);
  }
  return { width, height, data } as unknown as ImageData;
}

const opts = (over: Partial<DitherOptions>): DitherOptions => ({
  ...DEFAULT_DITHER_OPTIONS,
  ...over,
});

const solid =
  (rgba: [number, number, number, number]) =>
  (): [number, number, number, number] =>
    rgba;

describe("ditherImageData", () => {
  it("mutates and returns the same ImageData object", () => {
    const image = makeImage(4, 4, solid([128, 128, 128, 255]));
    const result = ditherImageData(image, opts({ mode: "gray" }));
    expect(result).toBe(image);
  });

  it("leaves fully-transparent pixels untouched", () => {
    const image = makeImage(2, 2, solid([7, 9, 11, 0]));
    ditherImageData(image, opts({ mode: "mono", preserveAlpha: true }));
    expect([...image.data]).toEqual([
      7, 9, 11, 0, 7, 9, 11, 0, 7, 9, 11, 0, 7, 9, 11, 0,
    ]);
  });

  it("mono mode collapses to exactly the two endpoint colors", () => {
    const image = makeImage(8, 8, solid([128, 128, 128, 255]));
    ditherImageData(
      image,
      opts({ mode: "mono", dark: "#000000", light: "#ffffff" }),
    );
    let black = 0;
    let white = 0;
    for (let i = 0; i < image.data.length; i += 4) {
      const px = `${image.data[i]},${image.data[i + 1]},${image.data[i + 2]}`;
      if (px === "0,0,0") black++;
      else if (px === "255,255,255") white++;
      else throw new Error(`unexpected mono pixel: ${px}`);
    }
    // A mid-gray field should dither into a mix, not one flat color.
    expect(black).toBeGreaterThan(0);
    expect(white).toBeGreaterThan(0);
    expect(black + white).toBe(64);
  });

  it("gray mode yields grayscale output (r === g === b)", () => {
    const image = makeImage(8, 8, (p) => {
      const v = (p * 4) % 256;
      return [v, v * 0.5, 255 - v, 255];
    });
    ditherImageData(image, opts({ mode: "gray", levels: 4 }));
    for (let i = 0; i < image.data.length; i += 4) {
      expect(image.data[i]).toBe(image.data[i + 1]);
      expect(image.data[i + 1]).toBe(image.data[i + 2]);
    }
  });

  it("palette mode maps every opaque pixel to a palette member", () => {
    const image = makeImage(8, 8, (p) => {
      const v = (p * 8) % 256;
      return [v, 255 - v, v, 255];
    });
    ditherImageData(image, opts({ mode: "palette", palette: "#000000 #ffffff" }));
    for (let i = 0; i < image.data.length; i += 4) {
      const px = `${image.data[i]},${image.data[i + 1]},${image.data[i + 2]}`;
      expect(["0,0,0", "255,255,255"]).toContain(px);
    }
  });

  it("forces alpha to 255 for processed pixels when preserveAlpha is false", () => {
    const image = makeImage(4, 4, solid([100, 150, 200, 40]));
    ditherImageData(image, opts({ mode: "rgb", preserveAlpha: false }));
    for (let i = 3; i < image.data.length; i += 4) {
      expect(image.data[i]).toBe(255);
    }
  });
});
