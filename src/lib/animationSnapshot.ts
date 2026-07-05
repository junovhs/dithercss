/** Resolve on the given window's next animation frame. */
export function nextFrame(win: Window): Promise<void> {
  return new Promise((resolve) => win.requestAnimationFrame(() => resolve()));
}

/** Convert a camelCase/JS keyframe property name to its CSS custom-property form. */
export function cssPropertyName(name: string): string {
  if (name.startsWith("--")) return name;
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/** The frozen-frame applier returned by {@link snapshotDocumentAnimations}. */
export interface AnimationSnapshot {
  /** Freeze animated properties onto the html2canvas clone. */
  apply(clonedDoc: Document): void;
  /** Remove capture-id attributes tagged on the live document. */
  cleanup(): void;
}

interface PerTargetSnapshot {
  token: string;
  pseudo: string;
  properties: Set<string>;
  values: [string, string][];
}

/**
 * Freeze all Web Animations in `doc` at `seconds`, recording the computed value
 * of every animated property so html2canvas (which cannot see live animation
 * state) can render an exact frame. Returns an applier + cleanup pair.
 */
export async function snapshotDocumentAnimations(
  doc: Document,
  seconds: number,
): Promise<AnimationSnapshot> {
  const win = doc.defaultView;
  if (!win) throw new Error("Capture frame is not ready.");
  const getAnimations = doc.getAnimations as
    | ((options?: { subtree?: boolean }) => Animation[])
    | undefined;
  const animations =
    typeof getAnimations === "function"
      ? getAnimations.call(doc, { subtree: true })
      : [];
  const tagged: Element[] = [];
  const snapshots = new Map<string, PerTargetSnapshot>();

  if (!animations.length) {
    return { apply() {}, cleanup() {} };
  }

  for (const animation of animations) {
    try {
      animation.pause();
    } catch {
      /* ignore */
    }
  }
  await Promise.allSettled(animations.map((animation) => animation.ready));
  for (const animation of animations) {
    try {
      animation.currentTime = Math.max(0, seconds * 1000);
    } catch {
      /* ignore */
    }
  }
  await nextFrame(win);

  let tokenIndex = 0;
  for (const animation of animations) {
    const effect = animation.effect as KeyframeEffect | null;
    const target = effect?.target;
    if (!(target instanceof win.Element)) continue;
    let token = target.getAttribute("data-bayer-capture-id");
    if (!token) {
      token = `bayer-${tokenIndex++}`;
      target.setAttribute("data-bayer-capture-id", token);
      tagged.push(target);
    }
    const pseudo = effect?.pseudoElement || "";
    const key = `${token}|${pseudo}`;
    if (!snapshots.has(key)) {
      snapshots.set(key, { token, pseudo, properties: new Set(), values: [] });
    }
    const snapshot = snapshots.get(key)!;
    for (const keyframe of effect!.getKeyframes()) {
      for (const property of Object.keys(keyframe)) {
        if (!["offset", "computedOffset", "easing", "composite"].includes(property)) {
          snapshot.properties.add(cssPropertyName(property));
        }
      }
    }
  }

  for (const snapshot of snapshots.values()) {
    const source = doc.querySelector(`[data-bayer-capture-id="${snapshot.token}"]`);
    if (!source) continue;
    const computed = win.getComputedStyle(source, snapshot.pseudo || null);
    snapshot.values = [...snapshot.properties].map((property) => [
      property,
      computed.getPropertyValue(property),
    ]);
  }

  return {
    apply(clonedDoc: Document) {
      const pseudoRules: string[] = [];
      for (const snapshot of snapshots.values()) {
        const selector = `[data-bayer-capture-id="${snapshot.token}"]`;
        if (snapshot.pseudo) {
          const declarations = snapshot.values
            .map(([property, value]) => `${property}:${value} !important;`)
            .join("");
          pseudoRules.push(
            `${selector}${snapshot.pseudo}{${declarations}animation:none !important;transition:none !important;}`,
          );
          continue;
        }
        const clone = clonedDoc.querySelector<HTMLElement>(selector);
        if (!clone) continue;
        for (const [property, value] of snapshot.values) {
          clone.style.setProperty(property, value, "important");
        }
        clone.style.setProperty("animation", "none", "important");
        clone.style.setProperty("transition", "none", "important");
      }
      if (pseudoRules.length) {
        const style = clonedDoc.createElement("style");
        style.textContent = pseudoRules.join("\n");
        clonedDoc.head.append(style);
      }
    },
    cleanup() {
      for (const element of tagged) {
        element.removeAttribute("data-bayer-capture-id");
      }
    },
  };
}
