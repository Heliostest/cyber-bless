import { useLayoutEffect, useRef } from "react";

/**
 * Fits a text area's height to its text as it is typed, so a rounded field
 * needs no native resize grip and never scrolls inside itself. It never
 * shrinks below the height its `rows` give it. Pass the field's value.
 */
export function useAutoGrow(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const field = ref.current;
    if (!field) return;
    let previousWidth = -1, disposed = false;
    const fit = () => {
      if (disposed) return;
      // Changing height does not change the draft, selection, focus or composition.
      field.style.height = "";
      const style = getComputedStyle(field);
      const borders = (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0);
      if (field.scrollHeight > field.clientHeight) field.style.height = `${field.scrollHeight + borders}px`;
    };
    const resize = typeof ResizeObserver === "function" ? new ResizeObserver(() => {
      const width = field.getBoundingClientRect().width;
      // Ignore our own height changes, otherwise ResizeObserver can loop.
      if (width !== previousWidth) { previousWidth = width; fit(); }
    }) : undefined;
    const language = typeof MutationObserver === "function" ? new MutationObserver(fit) : undefined;
    language?.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    resize?.observe(field);
    window.addEventListener("resize", fit);
    document.fonts?.addEventListener("loadingdone", fit);
    document.fonts?.ready?.then(fit);
    fit();
    return () => {
      disposed = true; resize?.disconnect(); language?.disconnect();
      window.removeEventListener("resize", fit);
      document.fonts?.removeEventListener("loadingdone", fit);
    };
  }, [value]);
  return ref;
}
