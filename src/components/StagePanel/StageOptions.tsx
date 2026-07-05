import { Camera } from "lucide-react";

import { IconButton } from "../ui/IconButton";
import { useRenderer } from "../../hooks/useRenderer";
import { useStore } from "../../state/useStore";
import styles from "./StageOptions.module.css";

/** Live-dither / preserve-alpha toggles and the exact-frame render action. */
export function StageOptions() {
  const renderer = useRenderer();
  const liveDither = useStore((s) => s.liveDither);
  const setLiveDither = useStore((s) => s.setLiveDither);
  const preserveAlpha = useStore((s) => s.options.preserveAlpha);
  const setOption = useStore((s) => s.setOption);

  return (
    <div className={styles.options}>
      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={liveDither}
          onChange={(event) => setLiveDither(event.target.checked)}
        />{" "}
        Live dither
      </label>
      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={preserveAlpha}
          onChange={(event) => setOption("preserveAlpha", event.target.checked)}
        />{" "}
        Preserve alpha
      </label>
      <IconButton
        icon={Camera}
        onClick={() => renderer.renderAt(renderer.currentTimeSeconds())}
      >
        Render exact frame
      </IconButton>
    </div>
  );
}
