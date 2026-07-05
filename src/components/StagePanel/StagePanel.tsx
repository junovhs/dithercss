import { useEffect, useRef } from "react";
import { RotateCcw } from "lucide-react";

import { IconButton } from "../ui/IconButton";
import { Panel } from "../ui/Panel";
import { StageOptions } from "./StageOptions";
import { Timeline } from "./Timeline";
import { Viewer } from "./Viewer";
import { cx } from "../../lib/cx";
import { useRenderer } from "../../hooks/useRenderer";
import { useStore } from "../../state/useStore";
import styles from "./StagePanel.module.css";

/**
 * Central render stage: source + dithered viewers, the offscreen capture frame,
 * the transport, and the stage options. Owns the effect that hands the DOM
 * elements to the {@link Renderer} and keeps it in sync with the store.
 */
export function StagePanel() {
  const renderer = useRenderer();
  const sourceFrame = useRef<HTMLIFrameElement>(null);
  const captureFrame = useRef<HTMLIFrameElement>(null);
  const outputCanvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!sourceFrame.current || !captureFrame.current || !outputCanvas.current) {
      return;
    }
    renderer.attach({
      sourceFrame: sourceFrame.current,
      captureFrame: captureFrame.current,
      outputCanvas: outputCanvas.current,
    });
    renderer.applySource();
    renderer.startLoop();

    // Re-dither the paused frame whenever tuning or source scale changes
    // (matches queueRerender), and mirror the magnify in the live preview.
    const applyPreviewScale = (scale: number) => {
      const frame = sourceFrame.current;
      if (!frame) return;
      frame.style.transformOrigin = "center";
      frame.style.transform = scale > 1 ? `scale(${scale})` : "";
    };
    applyPreviewScale(useStore.getState().sourceScale);
    const unsubscribe = useStore.subscribe((state, prev) => {
      if (state.options !== prev.options || state.sourceScale !== prev.sourceScale) {
        renderer.rerenderIfPaused();
      }
      if (state.sourceScale !== prev.sourceScale) applyPreviewScale(state.sourceScale);
    });

    return () => {
      unsubscribe();
      renderer.detach();
    };
  }, [renderer]);

  return (
    <Panel
      title="Animation render"
      subtitle="source and processed frame"
      actions={
        <IconButton icon={RotateCcw} onClick={() => renderer.restart()}>
          Restart
        </IconButton>
      }
    >
      <div className={styles.body}>
        <div className={styles.grid}>
          <Viewer label="Source">
            <iframe
              ref={sourceFrame}
              className={styles.frame}
              title="Source animation"
              sandbox="allow-same-origin"
            />
          </Viewer>
          <Viewer label="Bayer output">
            <canvas ref={outputCanvas} className={cx(styles.frame, styles.canvas)} />
          </Viewer>
        </div>
        <Timeline />
        <StageOptions />
      </div>
      <iframe
        ref={captureFrame}
        className={styles.captureFrame}
        title="Offscreen capture frame"
        sandbox="allow-same-origin"
        aria-hidden
        tabIndex={-1}
      />
    </Panel>
  );
}
