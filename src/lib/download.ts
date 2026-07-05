/** A timestamped `stem-<iso>.ext` filename safe for downloads. */
export function safeFileName(stem: string, extension: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${stem}-${stamp}.${extension}`;
}

/** Trigger a browser download of `blob` as `filename`. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Promise wrapper around `canvas.toBlob`. */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = "image/png",
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas encoding failed."))),
      type,
      quality,
    ),
  );
}
