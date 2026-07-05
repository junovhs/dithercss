import type { BayerSize } from "../../types";

/**
 * Build a `size × size` ordered Bayer threshold matrix by recursively growing
 * the canonical 2×2 seed. Values range `0 .. size*size-1`.
 */
export function makeBayerMatrix(size: BayerSize): number[][] {
  if (![2, 4, 8, 16].includes(size)) {
    throw new RangeError("Bayer size must be 2, 4, 8, or 16.");
  }
  let matrix = [
    [0, 2],
    [3, 1],
  ];
  let current = 2;
  while (current < size) {
    const nextSize = current * 2;
    const next: number[][] = Array.from({ length: nextSize }, () =>
      Array(nextSize).fill(0),
    );
    for (let y = 0; y < current; y += 1) {
      for (let x = 0; x < current; x += 1) {
        const value = matrix[y][x] * 4;
        next[y][x] = value;
        next[y][x + current] = value + 2;
        next[y + current][x] = value + 3;
        next[y + current][x + current] = value + 1;
      }
    }
    matrix = next;
    current = nextSize;
  }
  return matrix;
}
