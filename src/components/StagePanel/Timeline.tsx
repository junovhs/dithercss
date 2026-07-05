import { Pause, Play } from "lucide-react";

import { IconButton } from "../ui/IconButton";
import { useRenderer } from "../../hooks/useRenderer";
import { useStore } from "../../state/useStore";
import styles from "./Timeline.module.css";

/** Transport row: play/pause, scrub slider, and time readout. */
export function Timeline() {
  const renderer = useRenderer();
  const playing = useStore((s) => s.playing);
  const currentTime = useStore((s) => s.currentTime);
  const duration = useStore((s) => s.duration);

  return (
    <div className={styles.timeline}>
      <IconButton
        icon={playing ? Pause : Play}
        onClick={() => (playing ? renderer.pause() : renderer.play())}
      >
        {playing ? "Pause" : "Play"}
      </IconButton>
      <input
        type="range"
        min={0}
        max={duration}
        step={0.001}
        value={Math.min(currentTime, duration)}
        onChange={(event) => renderer.seek(Number(event.target.value))}
      />
      <span className={styles.readout}>
        {currentTime.toFixed(3)} / {duration.toFixed(3)}s
      </span>
    </div>
  );
}
