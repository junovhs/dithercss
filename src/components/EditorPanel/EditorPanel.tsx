import { useRef } from "react";
import { FolderOpen, Image as ImageIcon, Play, Video } from "lucide-react";

import { IconButton } from "../ui/IconButton";
import { Panel } from "../ui/Panel";
import { useRenderer } from "../../hooks/useRenderer";
import { useStore } from "../../state/useStore";
import styles from "./EditorPanel.module.css";

/** The combined HTML+CSS source editor with load/apply actions. */
export function EditorPanel({ className }: { className?: string }) {
  const renderer = useRenderer();
  const source = useStore((s) => s.source);
  const setSource = useStore((s) => s.setSource);
  const sourceType = useStore((s) => s.sourceType);
  const mediaName = useStore((s) => s.mediaName);
  const fileInput = useRef<HTMLInputElement>(null);

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.type.startsWith("image/")) {
      await renderer.loadImageFile(file);
    } else if (file.type.startsWith("video/")) {
      await renderer.loadVideoFile(file);
    } else {
      setSource(await file.text());
      renderer.applySource();
    }
  };

  return (
    <Panel
      title="HTML + CSS"
      subtitle="or load an image / video"
      className={className}
      actions={
        <>
          <IconButton icon={FolderOpen} onClick={() => fileInput.current?.click()}>
            Load file
          </IconButton>
          <IconButton icon={Play} variant="primary" onClick={() => renderer.applySource()}>
            Apply code
          </IconButton>
          <input
            ref={fileInput}
            type="file"
            accept=".html,.htm,.css,.txt,image/*,video/*"
            hidden
            onChange={onFile}
          />
        </>
      }
    >
      {sourceType !== "html" ? (
        <div className={styles.mediaNote}>
          {sourceType === "video" ? <Video aria-hidden /> : <ImageIcon aria-hidden />}
          <span>
            <strong>{sourceType === "video" ? "Video" : "Image"} loaded</strong>
            {mediaName ? ` — ${mediaName}` : ""}. Editing the code below and pressing{" "}
            <em>Apply code</em> switches back to HTML.
          </span>
        </div>
      ) : null}
      <textarea
        className={styles.code}
        spellCheck={false}
        aria-label="Combined HTML and CSS source"
        value={source}
        onChange={(event) => setSource(event.target.value)}
      />
    </Panel>
  );
}
