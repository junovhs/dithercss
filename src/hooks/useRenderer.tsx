import { createContext, useContext, useRef, type ReactNode } from "react";

import { Renderer } from "../engine/Renderer";

const RendererContext = createContext<Renderer | null>(null);

/** Provides a single {@link Renderer} instance to the component tree. */
export function RendererProvider({ children }: { children: ReactNode }) {
  const ref = useRef<Renderer | null>(null);
  ref.current ??= new Renderer();
  return (
    <RendererContext.Provider value={ref.current}>
      {children}
    </RendererContext.Provider>
  );
}

/** Access the shared {@link Renderer}. */
export function useRenderer(): Renderer {
  const renderer = useContext(RendererContext);
  if (!renderer) {
    throw new Error("useRenderer must be used within a <RendererProvider>.");
  }
  return renderer;
}
