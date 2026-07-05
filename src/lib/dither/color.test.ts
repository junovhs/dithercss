import { describe, expect, it } from "vitest";

import { nearestColor, parseHexColor, parsePalette, shapeRgb } from "./color";

describe("parseHexColor", () => {
  it("parses 6-digit hex", () => {
    expect(parseHexColor("#101018")).toEqual([16, 16, 24]);
    expect(parseHexColor("#ffffff")).toEqual([255, 255, 255]);
  });

  it("expands 3-digit hex and tolerates a missing #", () => {
    expect(parseHexColor("#fff")).toEqual([255, 255, 255]);
    expect(parseHexColor("abc")).toEqual([170, 187, 204]);
  });

  it("throws on invalid input", () => {
    expect(() => parseHexColor("#12")).toThrow(TypeError);
    expect(() => parseHexColor("nope")).toThrow(TypeError);
  });
});

describe("parsePalette", () => {
  it("splits on whitespace, commas and semicolons", () => {
    expect(parsePalette("#000000, #ffffff; #ff0000")).toEqual([
      [0, 0, 0],
      [255, 255, 255],
      [255, 0, 0],
    ]);
  });

  it("requires at least two colors", () => {
    expect(() => parsePalette("#000000")).toThrow(RangeError);
  });
});

describe("shapeRgb", () => {
  it("is identity at contrast=1, saturation=1, gamma=1", () => {
    const [r, g, b] = shapeRgb(128, 64, 200, 1, 1, 1);
    expect(r).toBeCloseTo(128 / 255, 5);
    expect(g).toBeCloseTo(64 / 255, 5);
    expect(b).toBeCloseTo(200 / 255, 5);
  });

  it("desaturates toward luma at saturation=0", () => {
    const [r, g, b] = shapeRgb(255, 0, 0, 1, 0, 1);
    expect(r).toBeCloseTo(g, 5);
    expect(g).toBeCloseTo(b, 5);
  });
});

describe("nearestColor", () => {
  it("picks the closest palette entry by squared distance", () => {
    const palette: [number, number, number][] = [
      [0, 0, 0],
      [255, 255, 255],
    ];
    expect(nearestColor(20, 20, 20, palette)).toEqual([0, 0, 0]);
    expect(nearestColor(200, 200, 200, palette)).toEqual([255, 255, 255]);
  });
});
