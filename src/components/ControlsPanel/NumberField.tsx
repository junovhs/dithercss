import { useId } from "react";

import { cx } from "../../lib/cx";
import styles from "./ControlsPanel.module.css";

interface NumberFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  /** Commit callback (blur/enter) — mirrors the original's `change` handler. */
  onCommit?: () => void;
}

/** A labeled numeric input on a two-column control row. */
export function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  onCommit,
}: NumberFieldProps) {
  const id = useId();
  return (
    <div className={cx(styles.control, styles.two)}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        onBlur={onCommit}
      />
    </div>
  );
}
