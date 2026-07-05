import { useCallback } from "react";

import {
  exportModule,
  exportPng,
  exportSequence,
  exportWebm,
} from "../engine/exporters";
import { useStore } from "../state/useStore";
import { useRenderer } from "./useRenderer";

/** Bound export handlers for the Export panel. */
export function useExport() {
  const renderer = useRenderer();
  const setStatus = useStore((s) => s.setStatus);

  const reportError = useCallback(
    (error: unknown) =>
      setStatus(error instanceof Error ? error.message : String(error), true),
    [setStatus],
  );

  return {
    png: useCallback(() => void exportPng(renderer), [renderer]),
    zip: useCallback(
      () => exportSequence(renderer).catch(reportError),
      [renderer, reportError],
    ),
    webm: useCallback(
      () => exportWebm(renderer).catch(reportError),
      [renderer, reportError],
    ),
    module: useCallback(() => exportModule(), []),
  };
}
