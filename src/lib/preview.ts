/**
 * Wrap user source into a full, centered, transparent-background HTML document
 * suitable for the preview/capture iframes. Injects a base stylesheet, handling
 * source that is either a full document or a bare fragment.
 */
export function buildPreviewDocument(source: string): string {
  const baseStyle = `<style id="bayer-studio-base">
    html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;}
    body{display:grid;place-items:center;}
  </style>`;
  const trimmed = source.trim();
  if (/<!doctype|<html[\s>]/i.test(trimmed)) {
    if (/<head[\s>]/i.test(trimmed)) {
      return trimmed.replace(/<head([^>]*)>/i, `<head$1>${baseStyle}`);
    }
    return trimmed.replace(/<html([^>]*)>/i, `<html$1><head>${baseStyle}</head>`);
  }
  return `<!doctype html><html><head><meta charset="utf-8">${baseStyle}</head><body>${source}</body></html>`;
}
