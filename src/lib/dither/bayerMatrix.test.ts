import { describe, expect, it } from "vitest";

import { makeBayerMatrix } from "./bayerMatrix";

describe("makeBayerMatrix", () => {
  it("returns the canonical 2x2 seed", () => {
    expect(makeBayerMatrix(2)).toEqual([
      [0, 2],
      [3, 1],
    ]);
  });

  it("grows to the canonical 4x4 ordered matrix", () => {
    expect(makeBayerMatrix(4)).toEqual([
      [0, 8, 2, 10],
      [12, 4, 14, 6],
      [3, 11, 1, 9],
      [15, 7, 13, 5],
    ]);
  });

  it("produces a full permutation of 0..size*size-1 with no repeats (8x8)", () => {
    const flat = makeBayerMatrix(8).flat().sort((a, b) => a - b);
    expect(flat).toEqual(Array.from({ length: 64 }, (_, i) => i));
  });

  it("is square of the requested size", () => {
    const m = makeBayerMatrix(16);
    expect(m).toHaveLength(16);
    expect(m.every((row) => row.length === 16)).toBe(true);
  });

  it("rejects non-power-of-two / out-of-range sizes", () => {
    // @ts-expect-error — 3 is not a BayerSize
    expect(() => makeBayerMatrix(3)).toThrow(RangeError);
    // @ts-expect-error — 32 is not a BayerSize
    expect(() => makeBayerMatrix(32)).toThrow(RangeError);
  });
});
