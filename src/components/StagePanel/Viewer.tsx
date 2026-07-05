import type { ReactNode } from "react";

import styles from "./Viewer.module.css";

/** A labeled, checkerboard-backed frame for the source iframe or output canvas. */
export function Viewer({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.viewer}>
      <span className={styles.label}>{label}</span>
      <div className={styles.frameWrap}>{children}</div>
    </div>
  );
}
