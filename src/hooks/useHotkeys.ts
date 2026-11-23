import { useEffect, useRef } from "react";

type Handler = (e: KeyboardEvent) => void;

/**
 * Global keyboard shortcuts. Keys are KeyboardEvent.key values ("F2", "Escape", "/").
 * Plain character keys are ignored while typing in an input, F-keys and Escape are not.
 */
export function useHotkeys(map: Record<string, Handler>, enabled = true) {
  const ref = useRef(map);
  ref.current = map;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const handler = ref.current[e.key];
      if (!handler) return;
      const target = e.target as HTMLElement | null;
      const typing =
        !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      const special = e.key.startsWith("F") && e.key.length > 1;
      if (typing && !special && e.key !== "Escape") return;
      handler(e);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
