import { create } from "zustand";

import { DEFAULT_DITHER_OPTIONS } from "../lib/dither/ditherImageData";
import { DEFAULT_SOURCE } from "../constants/defaultSource";
import type { DitherOptions, Dimensions, SourceType } from "../types";

/** Everything the UI binds to and the engine reads via `getState()`. */
export interface AppState {
  /** Editable source markup. */
  source: string;
  setSource: (source: string) => void;

  /** What the current source is: authored HTML, or a loaded image/video. */
  sourceType: SourceType;
  /** Display name of a loaded media file (empty for html). */
  mediaName: string;
  setMedia: (type: SourceType, name: string) => void;

  /** Capture/output geometry. */
  width: number;
  height: number;
  setWidth: (width: number) => void;
  setHeight: (height: number) => void;

  /** Timeline extent and export frame rate. */
  duration: number;
  fps: number;
  setDuration: (duration: number) => void;
  setFps: (fps: number) => void;

  /** Magnify factor (>=1) applied to the source before dithering. */
  sourceScale: number;
  setSourceScale: (scale: number) => void;

  /** Full dither tuning read by `ditherImageData`. */
  options: DitherOptions;
  setOption: <K extends keyof DitherOptions>(
    key: K,
    value: DitherOptions[K],
  ) => void;

  /** Re-dither on every animated frame while playing. */
  liveDither: boolean;
  setLiveDither: (live: boolean) => void;

  /** Playback flag mirrored from the engine for the Play/Pause control. */
  playing: boolean;
  setPlaying: (playing: boolean) => void;

  /** Current playhead in seconds, driven by the engine's animation loop. */
  currentTime: number;
  setCurrentTime: (time: number) => void;

  /** Status line. */
  status: string;
  statusError: boolean;
  setStatus: (status: string, error?: boolean) => void;

  /** Export progress 0..1 and global busy (disables controls). */
  progress: number;
  setProgress: (progress: number) => void;
  busy: boolean;
  setBusy: (busy: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  source: DEFAULT_SOURCE,
  setSource: (source) => set({ source }),

  sourceType: "html",
  mediaName: "",
  setMedia: (sourceType, mediaName) => set({ sourceType, mediaName }),

  width: 320,
  height: 320,
  setWidth: (width) => set({ width }),
  setHeight: (height) => set({ height }),

  duration: 4.6,
  fps: 24,
  setDuration: (duration) => set({ duration }),
  setFps: (fps) => set({ fps }),

  sourceScale: 1,
  setSourceScale: (sourceScale) => set({ sourceScale }),

  options: { ...DEFAULT_DITHER_OPTIONS },
  setOption: (key, value) =>
    set((state) => ({ options: { ...state.options, [key]: value } })),

  liveDither: true,
  setLiveDither: (liveDither) => set({ liveDither }),

  playing: true,
  setPlaying: (playing) => set({ playing }),

  currentTime: 0,
  setCurrentTime: (currentTime) => set({ currentTime }),

  status: "Ready",
  statusError: false,
  setStatus: (status, error = false) => set({ status, statusError: error }),

  progress: 0,
  setProgress: (progress) => set({ progress }),
  busy: false,
  setBusy: (busy) => set({ busy }),
}));

/** Current geometry as a {@link Dimensions}, clamped like the original. */
export function currentDimensions(state: AppState): Dimensions {
  return {
    width: clampInt(state.width, 16, 2048),
    height: clampInt(state.height, 16, 2048),
  };
}

function clampInt(value: number, min: number, max: number): number {
  const rounded = Math.round(Number.isFinite(value) ? value : min);
  return Math.min(max, Math.max(min, rounded));
}
