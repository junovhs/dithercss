import { useEffect } from "react";

import { ControlsPanel } from "./components/ControlsPanel/ControlsPanel";
import { EditorPanel } from "./components/EditorPanel/EditorPanel";
import { ExportPanel } from "./components/ExportPanel/ExportPanel";
import { StagePanel } from "./components/StagePanel/StagePanel";
import { TopBar } from "./components/TopBar/TopBar";
import { RendererProvider } from "./hooks/useRenderer";
import { useStore } from "./state/useStore";
import styles from "./App.module.css";

export default function App() {
  const busy = useStore((s) => s.busy);
  useEffect(() => {
    document.body.classList.toggle("busy", busy);
  }, [busy]);

  return (
    <RendererProvider>
      <div className={styles.app}>
        <TopBar />
        <main className={styles.workspace}>
          <EditorPanel />
          <section className={styles.middleColumn}>
            <StagePanel />
            <ExportPanel />
          </section>
          <ControlsPanel />
        </main>
      </div>
    </RendererProvider>
  );
}
