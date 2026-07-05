import { cx } from "../../lib/cx";
import { useStore } from "../../state/useStore";
import styles from "./TopBar.module.css";

/** App header: brand and live status readout. */
export function TopBar() {
  const status = useStore((s) => s.status);
  const statusError = useStore((s) => s.statusError);
  return (
    <header className={styles.topbar}>
      <div className={styles.brand}>
        <h1>Bayer Studio</h1>
        <span>real ordered dithering for CSS animation</span>
      </div>
      <div className={cx(styles.status, statusError && styles.error)}>{status}</div>
    </header>
  );
}
