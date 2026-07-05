import { describe, expect, it } from "vitest";

import { orderedQuantize } from "./quantize";

describe("orderedQuantize", () => {
  it("keeps the endpoints at any threshold", () => {
    expect(orderedQuantize(0, 4, 0.5)).toBe(0);
    expect(orderedQuantize(1, 4, 0.5)).toBe(1);
  });

  it("rounds a within-step value up only when the fraction meets the threshold", () => {
    // levels=2 -> scaled = value; low=0, fraction=value
    expect(orderedQuantize(0.4, 2, 0.5)).toBe(0); // 0.4 < 0.5 -> down
    expect(orderedQuantize(0.4, 2, 0.3)).toBe(1); // 0.4 >= 0.3 -> up
  });

  it("clamps out-of-range input", () => {
    expect(orderedQuantize(-1, 4, 0.5)).toBe(0);
    expect(orderedQuantize(2, 4, 0.5)).toBe(1);
  });

  it("returns values on the levels grid", () => {
    const levels = 4;
    for (let i = 0; i <= 10; i++) {
      const q = orderedQuantize(i / 10, levels, 0.5);
      const step = Math.round(q * (levels - 1));
      expect(q).toBeCloseTo(step / (levels - 1), 6);
    }
  });
});
