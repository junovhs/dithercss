import type { ReactNode } from "react";

import { cx } from "../../lib/cx";
import styles from "./Panel.module.css";

interface PanelProps {
  title: string;
  subtitle?: string;
  /** Right-aligned header actions (buttons). */
  actions?: ReactNode;
  /** Extra class on the root `<section>` (e.g. grid placement). */
  className?: string;
  children: ReactNode;
}

/** The shared panel shell: bordered card with an uppercase header. */
export function Panel({ title, subtitle, actions, className, children }: PanelProps) {
  return (
    <section className={cx(styles.panel, className)}>
      <div className={styles.head}>
        <div>
          <h2>{title}</h2>
          {subtitle ? <small>{subtitle}</small> : null}
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
