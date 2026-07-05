import { useId } from "react";

import { cx } from "../../lib/cx";
import styles from "./ControlsPanel.module.css";

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SelectControlProps<T extends string> {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}

/** A labeled `<select>` on a two-column control row. */
export function SelectControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: SelectControlProps<T>) {
  const id = useId();
  return (
    <div className={cx(styles.control, styles.two)}>
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
