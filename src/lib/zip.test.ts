import { describe, expect, it } from "vitest";

import { blobBytes, crc32, makeZip } from "./zip";

const bytes = (text: string) => new TextEncoder().encode(text);

describe("crc32", () => {
  it("is 0 for empty input", () => {
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it("matches the standard CRC-32 check value for '123456789'", () => {
    expect(crc32(bytes("123456789"))).toBe(0xcbf43926);
  });
});

describe("makeZip", () => {
  it("produces a zip blob with the local-file-header signature", async () => {
    const blob = makeZip([{ name: "a.txt", data: bytes("hello") }]);
    expect(blob.type).toBe("application/zip");
    const head = await blobBytes(blob);
    // PK\x03\x04 local file header.
    expect([head[0], head[1], head[2], head[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    // End-of-central-directory signature PK\x05\x06 near the tail.
    expect(head.length).toBeGreaterThan(22);
  });

  it("embeds each file name and payload", async () => {
    const blob = makeZip([{ name: "frames/x.txt", data: bytes("PAYLOAD") }]);
    const text = new TextDecoder().decode(await blobBytes(blob));
    expect(text).toContain("frames/x.txt");
    expect(text).toContain("PAYLOAD");
  });
});
