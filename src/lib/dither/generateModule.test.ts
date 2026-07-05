import { describe, expect, it } from "vitest";

import { DEFAULT_DITHER_OPTIONS } from "./ditherImageData";
import { reusableModuleSource } from "./generateModule";

describe("reusableModuleSource", () => {
  const source = reusableModuleSource(DEFAULT_DITHER_OPTIONS);

  it("exports the expected public API", () => {
    expect(source).toContain("export const DEFAULT_BAYER_OPTIONS");
    expect(source).toContain("export function makeBayerMatrix");
    expect(source).toContain("export function ditherImageData");
  });

  it("bakes in the provided options as JSON", () => {
    expect(source).toContain('"mode": "rgb"');
    expect(source).toContain('"matrixSize": 8');
    const custom = reusableModuleSource({ ...DEFAULT_DITHER_OPTIONS, levels: 6 });
    expect(custom).toContain('"levels": 6');
  });

  it("emits a valid (parseable) regex escape in the palette splitter", () => {
    // The generated module must contain a real \s regex, not a broken escape.
    expect(source).toContain("split(/[\\s,;]+/)");
  });
});
