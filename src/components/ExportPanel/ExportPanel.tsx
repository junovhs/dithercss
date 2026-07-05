import { FileArchive, FileCode2, Image, Video } from "lucide-react";

import { IconButton } from "../ui/IconButton";
import { Panel } from "../ui/Panel";
import { useExport } from "../../hooks/useExport";
import { useStore } from "../../state/useStore";
import styles from "./ExportPanel.module.css";

/** Export actions (PNG / ZIP / WebM / JS filter) with a progress bar. */
export function ExportPanel() {
  const exporters = useExport();
  const progress = useStore((s) => s.progress);

  return (
    <Panel
      title="Export"
      subtitle="nearest-neighbor sharp output"
      className={styles.exportPanel}
    >
      <div className={styles.body}>
        <div className={styles.actions}>
          <IconButton icon={Image} variant="primary" onClick={exporters.png}>
            Current PNG
          </IconButton>
          <IconButton icon={FileArchive} onClick={exporters.zip}>
            PNG sequence ZIP
          </IconButton>
          <IconButton icon={Video} onClick={exporters.webm}>
            WebM video
          </IconButton>
          <IconButton icon={FileCode2} onClick={exporters.module}>
            Reusable JS filter
          </IconButton>
        </div>
        <div className={styles.progress}>
          <i style={{ width: `${Math.min(Math.max(progress, 0), 1) * 100}%` }} />
        </div>
        <p className={styles.hint}>
          PNG sequence is the exact frame pipeline. WebM support depends on the
          browser. Loaded JavaScript is disabled. The bundled local-file-safe DOM
          renderer supports self-contained HTML, CSS, inline SVG, gradients, shadows,
          and same-document assets best.
        </p>
      </div>
    </Panel>
  );
}
