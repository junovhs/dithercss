/** A single entry for {@link makeZip}. */
export interface ZipFile {
  name: string;
  data: Uint8Array;
}

/** CRC-32 (IEEE 802.3) over a byte array. */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function push16(target: number[], value: number): void {
  target.push(value & 255, (value >>> 8) & 255);
}

function push32(target: number[], value: number): void {
  target.push(
    value & 255,
    (value >>> 8) & 255,
    (value >>> 16) & 255,
    (value >>> 24) & 255,
  );
}

function concatUint8(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

/** Build a minimal (STORE method, no compression) ZIP blob from `files`. */
export function makeZip(files: ZipFile[]): Blob {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = file.data;
    const crc = crc32(data);

    const local: number[] = [];
    push32(local, 0x04034b50);
    push16(local, 20);
    push16(local, 0);
    push16(local, 0);
    push16(local, 0);
    push16(local, 0);
    push32(local, crc);
    push32(local, data.length);
    push32(local, data.length);
    push16(local, name.length);
    push16(local, 0);
    const localBytes = new Uint8Array(local);
    chunks.push(localBytes, name, data);

    const directory: number[] = [];
    push32(directory, 0x02014b50);
    push16(directory, 20);
    push16(directory, 20);
    push16(directory, 0);
    push16(directory, 0);
    push16(directory, 0);
    push16(directory, 0);
    push32(directory, crc);
    push32(directory, data.length);
    push32(directory, data.length);
    push16(directory, name.length);
    push16(directory, 0);
    push16(directory, 0);
    push16(directory, 0);
    push16(directory, 0);
    push32(directory, 0);
    push32(directory, offset);
    central.push(new Uint8Array(directory), name);
    offset += localBytes.length + name.length + data.length;
  }

  const centralBytes = concatUint8(central);
  chunks.push(centralBytes);
  const end: number[] = [];
  push32(end, 0x06054b50);
  push16(end, 0);
  push16(end, 0);
  push16(end, files.length);
  push16(end, files.length);
  push32(end, centralBytes.length);
  push32(end, offset);
  push16(end, 0);
  chunks.push(new Uint8Array(end));
  return new Blob(chunks as BlobPart[], { type: "application/zip" });
}

/** Read a Blob's bytes. */
export async function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}
