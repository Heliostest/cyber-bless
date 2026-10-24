import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { useApp } from "./context";
import { builtInScenes } from "./scene-library";

const MORPH_MS = 420;
const CLOSED_HEIGHT = 48;
type Geometry = { closedWidth: number; expandedWidth: number; expandedHeight: number };

export function RitualNarrativeBlurb({ sceneId, completion }: { sceneId: string; completion?: string }) {
  const app = useApp();
  const scene = builtInScenes.find((entry) => entry.id === sceneId);
  const narrative = scene?.narrative?.trim();
  const label = `${scene?.title}的介绍`;
  const bodyId = useId();
  const header = useRef<HTMLDivElement>(null), anchor = useRef<HTMLDivElement>(null);
  const shell = useRef<HTMLDivElement>(null), button = useRef<HTMLButtonElement>(null);
  const body = useRef<HTMLDivElement>(null), copy = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false), [present, setPresent] = useState(false);
  const openNow = useRef(false);
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const [systemReduced, setSystemReduced] = useState(false);
  const reducedMotion = (app?.state?.settings?.reducedMotion ?? false) || systemReduced;

  const close = useCallback(() => {
    openNow.current = false; setOpen(false);
    button.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const query = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!query) return;
    const changed = () => setSystemReduced(query.matches);
    changed();
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", changed);
      return () => query.removeEventListener("change", changed);
    }
    query.addListener?.(changed);
    return () => query.removeListener?.(changed);
  }, []);

  useLayoutEffect(() => {
    if (!narrative) return;
    const measure = () => {
      if (!anchor.current || !button.current || !shell.current || !copy.current) return;
      const rect = anchor.current.getBoundingClientRect(), viewport = window.visualViewport;
      const width = viewport?.width ?? window.innerWidth;
      const bottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight);
      const closedWidth = Math.ceil(button.current.getBoundingClientRect().width || 166) + 4;
      const availableWidth = header.current?.getBoundingClientRect().width || width - rect.left - 16;
      const expandedWidth = Math.max(closedWidth, Math.min(430, availableWidth, width - rect.left - 12));
      // Final text wrapping is independent of the changing shell: text never stretches.
      shell.current.style.setProperty("--ritual-narrative-expanded-width", `${expandedWidth}px`);
      const naturalHeight = Math.max(copy.current.scrollHeight, copy.current.getBoundingClientRect().height);
      const availableHeight = Math.max(CLOSED_HEIGHT + 44, bottom - rect.top - 12);
      const expandedHeight = Math.ceil(Math.min(CLOSED_HEIGHT + naturalHeight + 32, availableHeight));
      const next = { closedWidth, expandedWidth, expandedHeight };
      setGeometry(previous => previous && Object.keys(next).every(key => previous[key as keyof Geometry] === next[key as keyof Geometry]) ? previous : next);
    };
    measure();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : undefined;
    if (header.current) observer?.observe(header.current);
    if (copy.current) observer?.observe(copy.current);
    window.addEventListener("resize", measure); window.visualViewport?.addEventListener("resize", measure);
    return () => {
      observer?.disconnect(); window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [narrative]);

  useLayoutEffect(() => { if (open) body.current?.focus({ preventScroll: true }); }, [open]);

  useEffect(() => {
    if (open || !present) return;
    if (reducedMotion) { setPresent(false); return; }
    const timer = window.setTimeout(() => { if (!openNow.current) setPresent(false); }, MORPH_MS);
    return () => window.clearTimeout(timer);
  }, [open, present, reducedMotion]);

  useEffect(() => {
    if (!present) return;
    const outside = (event: Event) => !shell.current?.contains(event.target as Node);
    const stopOutside = (event: Event) => {
      if (!outside(event)) return;
      event.preventDefault(); event.stopImmediatePropagation();
    };
    const outsideClick = (event: MouseEvent) => {
      if (!outside(event)) return;
      stopOutside(event); close();
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault(); event.stopImmediatePropagation(); close();
      } else if (event.key === "Tab") {
        event.preventDefault();
        const next = openNow.current && document.activeElement === button.current ? body.current : button.current;
        next?.focus({ preventScroll: true });
      }
    };
    const focusin = (event: FocusEvent) => {
      if (outside(event)) (openNow.current ? body.current : button.current)?.focus({ preventScroll: true });
    };
    const preventOuterScroll = (event: Event) => {
      if (!body.current?.contains(event.target as Node)) event.preventDefault();
    };
    const originalOverflow = document.body.style.overflow, originalPadding = document.body.style.paddingRight;
    const ownsScrollLock = originalOverflow !== "hidden";
    // The scene viewport may already own the lock and release it before we unmount.
    if (ownsScrollLock) {
      const clientWidth = document.documentElement.clientWidth;
      const scrollbar = clientWidth > 0 ? Math.max(0, window.innerWidth - clientWidth) : 0;
      if (scrollbar) document.body.style.paddingRight = `${(Number.parseFloat(getComputedStyle(document.body).paddingRight) || 0) + scrollbar}px`;
      document.body.style.overflow = "hidden";
    }
    document.addEventListener("pointerdown", stopOutside, true); document.addEventListener("click", outsideClick, true);
    document.addEventListener("keydown", keydown, true); document.addEventListener("focusin", focusin, true);
    document.addEventListener("wheel", preventOuterScroll, { capture: true, passive: false });
    document.addEventListener("touchmove", preventOuterScroll, { capture: true, passive: false });
    return () => {
      if (ownsScrollLock) {
        document.body.style.overflow = originalOverflow; document.body.style.paddingRight = originalPadding;
      }
      document.removeEventListener("pointerdown", stopOutside, true); document.removeEventListener("click", outsideClick, true);
      document.removeEventListener("keydown", keydown, true); document.removeEventListener("focusin", focusin, true);
      document.removeEventListener("wheel", preventOuterScroll, true); document.removeEventListener("touchmove", preventOuterScroll, true);
    };
  }, [present, close]);

  useEffect(() => {
    openNow.current = false; setOpen(false); setPresent(false);
    if (body.current) body.current.scrollTop = 0;
  }, [sceneId]);

  if (!narrative && !completion) return null;
  const size = geometry ? {
    "--ritual-narrative-closed-width": `${geometry.closedWidth}px`,
    "--ritual-narrative-expanded-width": `${geometry.expandedWidth}px`,
    "--ritual-narrative-expanded-height": `${geometry.expandedHeight}px`,
  } as CSSProperties : undefined;
  return (
    <div ref={header} className="ritual-narrative-header" data-narrative-present={present || undefined}>
      {narrative && <div className="ritual-narrative-anchor" ref={anchor}>
        {present && <div className="ritual-narrative-backdrop" aria-hidden="true" />}
        <div ref={shell} className="ritual-narrative ritual-narrative-panel" data-open={open} data-reduced-motion={reducedMotion || undefined}
          style={size} role={open ? "dialog" : undefined} aria-modal={open || undefined} aria-label={open ? label : undefined}
          onTransitionEnd={event => {
            if (event.target === event.currentTarget && event.propertyName === "height" && !openNow.current) setPresent(false);
          }}>
          <button ref={button} type="button" className="ritual-narrative-toggle ritual-narrative-trigger" aria-haspopup="dialog"
            aria-expanded={open} aria-controls={bodyId} onClick={() => {
              if (openNow.current) close();
              else { openNow.current = true; setPresent(true); setOpen(true); }
            }}><span className="ritual-narrative-chevron" aria-hidden="true" /><span>了解这个仪式</span></button>
          <div ref={body} id={bodyId} className="ritual-narrative-body" role="region" aria-label={label}
            aria-hidden={!open} inert={!open} tabIndex={0}>
            <div ref={copy} className="ritual-narrative-copy">
              {narrative.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            </div>
          </div>
        </div>
      </div>}
      {completion && <p className="scene-complete-status" role="status">{completion}</p>}
    </div>
  );
}
