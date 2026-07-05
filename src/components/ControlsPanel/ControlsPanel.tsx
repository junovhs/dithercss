import { Panel } from "../ui/Panel";
import { NumberField } from "./NumberField";
import { RangeControl } from "./RangeControl";
import { SelectControl } from "./SelectControl";
import { cx } from "../../lib/cx";
import { useRenderer } from "../../hooks/useRenderer";
import { useStore } from "../../state/useStore";
import type { BayerSize, DitherMode } from "../../types";
import styles from "./ControlsPanel.module.css";

const MODE_OPTIONS: { value: DitherMode; label: string }[] = [
  { value: "rgb", label: "RGB levels" },
  { value: "gray", label: "Grayscale" },
  { value: "mono", label: "Two-color / mono" },
  { value: "palette", label: "Custom palette" },
];

const MATRIX_OPTIONS = [
  { value: "2", label: "2" },
  { value: "4", label: "4" },
  { value: "8", label: "8" },
  { value: "16", label: "16" },
];

/** The full "Dither tuning" panel: capture, ordered pattern, and image shaping. */
export function ControlsPanel({ className }: { className?: string }) {
  const renderer = useRenderer();
  const options = useStore((s) => s.options);
  const setOption = useStore((s) => s.setOption);
  const width = useStore((s) => s.width);
  const height = useStore((s) => s.height);
  const duration = useStore((s) => s.duration);
  const fps = useStore((s) => s.fps);
  const sourceScale = useStore((s) => s.sourceScale);
  const setWidth = useStore((s) => s.setWidth);
  const setHeight = useStore((s) => s.setHeight);
  const setDuration = useStore((s) => s.setDuration);
  const setFps = useStore((s) => s.setFps);
  const setSourceScale = useStore((s) => s.setSourceScale);

  const levelsDisabled = options.mode === "mono" || options.mode === "palette";

  return (
    <Panel
      title="Dither tuning"
      subtitle="ordered Bayer controls"
      className={cx(styles.controlsColumn, className)}
    >
      <div className={styles.controls}>
        <div className={styles.group}>
          <h3>Capture</h3>
          <div className={styles.dimensionRow}>
            <label>
              Width
              <input
                type="number"
                min={16}
                max={2048}
                step={1}
                value={width}
                onChange={(event) => setWidth(Number(event.target.value))}
                onBlur={() => renderer.reflow()}
              />
            </label>
            <label>
              Height
              <input
                type="number"
                min={16}
                max={2048}
                step={1}
                value={height}
                onChange={(event) => setHeight(Number(event.target.value))}
                onBlur={() => renderer.reflow()}
              />
            </label>
          </div>
          <RangeControl
            label="Source scale"
            value={sourceScale}
            min={1}
            max={8}
            step={0.25}
            onChange={setSourceScale}
          />
          <NumberField
            label="Duration"
            value={duration}
            min={0.1}
            max={60}
            step={0.1}
            onChange={setDuration}
          />
          <NumberField
            label="Export FPS"
            value={fps}
            min={1}
            max={60}
            step={1}
            onChange={setFps}
          />
          <div className={cx(styles.control, styles.two)}>
            <label htmlFor="matteColor">Matte</label>
            <input
              id="matteColor"
              type="color"
              value={options.matte}
              onChange={(event) => setOption("matte", event.target.value)}
            />
          </div>
        </div>

        <div className={styles.group}>
          <h3>Ordered pattern</h3>
          <SelectControl
            label="Mode"
            value={options.mode}
            options={MODE_OPTIONS}
            onChange={(value) => setOption("mode", value)}
          />
          <SelectControl
            label="Bayer matrix"
            value={String(options.matrixSize)}
            options={MATRIX_OPTIONS}
            onChange={(value) => setOption("matrixSize", Number(value) as BayerSize)}
          />
          <RangeControl
            label="Levels"
            value={options.levels}
            min={2}
            max={16}
            step={1}
            disabled={levelsDisabled}
            onChange={(value) => setOption("levels", value)}
          />
          <RangeControl
            label="Strength"
            value={options.strength}
            min={0}
            max={2.5}
            step={0.01}
            onChange={(value) => setOption("strength", value)}
          />
          <RangeControl
            label="Threshold bias"
            value={options.bias}
            min={-0.5}
            max={0.5}
            step={0.005}
            onChange={(value) => setOption("bias", value)}
          />
          <RangeControl
            label="Pattern scale"
            value={options.patternScale}
            min={1}
            max={8}
            step={1}
            onChange={(value) => setOption("patternScale", value)}
          />
          <RangeControl
            label="Pixel size"
            value={options.pixelSize}
            min={1}
            max={12}
            step={1}
            onChange={(value) => setOption("pixelSize", value)}
          />
        </div>

        <div className={styles.group}>
          <h3>Image shaping</h3>
          <RangeControl
            label="Gamma"
            value={options.gamma}
            min={0.2}
            max={3}
            step={0.01}
            onChange={(value) => setOption("gamma", value)}
          />
          <RangeControl
            label="Contrast"
            value={options.contrast}
            min={0}
            max={3}
            step={0.01}
            onChange={(value) => setOption("contrast", value)}
          />
          <RangeControl
            label="Saturation"
            value={options.saturation}
            min={0}
            max={3}
            step={0.01}
            onChange={(value) => setOption("saturation", value)}
          />
          {options.mode === "mono" ? (
            <div className={styles.colorRow}>
              <label className={styles.colorField}>
                Dark
                <input
                  type="color"
                  value={options.dark}
                  onChange={(event) => setOption("dark", event.target.value)}
                />
              </label>
              <label className={styles.colorField}>
                Light
                <input
                  type="color"
                  value={options.light}
                  onChange={(event) => setOption("light", event.target.value)}
                />
              </label>
            </div>
          ) : null}
          {options.mode === "palette" ? (
            <textarea
              className={styles.paletteBox}
              spellCheck={false}
              value={options.palette}
              onChange={(event) => setOption("palette", event.target.value)}
            />
          ) : null}
        </div>
      </div>
    </Panel>
  );
}
