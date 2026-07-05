import { useId } from "react";

import styles from "./ControlsPanel.module.css";

interface RangeControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

/** A labeled range slider with a live numeric readout (the `.control` row). */
export function RangeControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  disabled,
}: RangeControlProps) {
  const id = useId();
  return (
    <div className={styles.control}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <output>{formatReadout(value, step)}</output>
    </div>
  );
}

/** Match the original's step-derived decimal precision (capped at 3). */
function formatReadout(value: number, step: number): string {
  const stepText = String(step);
  const decimals = stepText.includes(".") ? (stepText.split(".")[1] || "").length : 0;
  return value.toFixed(Math.min(decimals, 3));
}
