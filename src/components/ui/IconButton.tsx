import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";

import { cx } from "../../lib/cx";
import { useStore } from "../../state/useStore";
import styles from "./IconButton.module.css";

interface IconButtonProps {
  onClick: () => void;
  children: ReactNode;
  /** A lucide-react icon component. */
  icon?: ComponentType<LucideProps>;
  variant?: "primary" | "danger";
  /** Force-disable regardless of the global busy state. */
  disabled?: boolean;
  className?: string;
  title?: string;
}

/**
 * A button with an optional leading lucide icon. Disables itself whenever an
 * export is in progress (global `busy`), matching the original app's behavior.
 */
export function IconButton({
  onClick,
  children,
  icon: Icon,
  variant,
  disabled,
  className,
  title,
}: IconButtonProps) {
  const busy = useStore((s) => s.busy);
  return (
    <button
      type="button"
      className={cx(styles.button, variant, className)}
      onClick={onClick}
      disabled={busy || disabled}
      title={title}
    >
      {Icon ? <Icon aria-hidden /> : null}
      {children}
    </button>
  );
}
