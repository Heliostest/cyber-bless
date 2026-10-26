import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "./art";
import { useApp } from "./context";
import { VisualStyleControl } from "./visual-style-menu";

const MORPH_MS = 420;
const dismissEvent = "wbr:close-feedback-menu";
const openMenus: HTMLElement[] = [];

/** Consume native Back while this App's settings shell is open or closing. */
export function dismissFeedbackMenu(scope?: HTMLElement | null): boolean {
  return !document.dispatchEvent(new CustomEvent(dismissEvent, { cancelable: true, detail: scope }));
}

/** One anchored shell expands downwards without replacing its setting controls. */
export function FeedbackControls({ sceneId }: { sceneId?: string } = {}) {
  const { state, dispatch, canHaptic } = useApp();
  const optionsId = useId();
  const shell = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false), [present, setPresent] = useState(false);
  const openNow = useRef(false), presentNow = useRef(false), childOpen = useRef(false);
  // Keep the rest of an outside gesture blocked even if reduced motion closes immediately.
  const suppressOutsideClick = useRef(false);
  const [systemReduced, setSystemReduced] = useState(false);
  const reducedMotion = state.settings.reducedMotion || systemReduced;

  const close = useCallback(() => {
    openNow.current = false; setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }, []);
  const finishClosing = useCallback(() => {
    if (openNow.current) return;
    presentNow.current = false; setPresent(false);
  }, []);
  const onChildOpenChange = useCallback((value: boolean) => { childOpen.current = value; }, []);

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
    if (!present || !shell.current) return;
    const element = shell.current; openMenus.push(element);
    return () => {
      const index = openMenus.indexOf(element); if (index >= 0) openMenus.splice(index, 1);
    };
  }, [present]);

  useEffect(() => {
    if (open || !present) return;
    if (reducedMotion) { finishClosing(); return; }
    const timer = window.setTimeout(finishClosing, MORPH_MS);
    return () => window.clearTimeout(timer);
  }, [open, present, reducedMotion, finishClosing]);

  useEffect(() => {
    const ownsEvents = () => presentNow.current && openMenus.at(-1) === shell.current && !childOpen.current;
    const outside = (event: Event) => !shell.current?.contains(event.target as Node);
    const stop = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); };
    const pointerdown = (event: Event) => {
      // A fresh gesture releases any abandoned pointerdown's pending click shield.
      suppressOutsideClick.current = false;
      if (!ownsEvents() || !outside(event)) return;
      suppressOutsideClick.current = true; stop(event); close();
    };
    const click = (event: Event) => {
      if (childOpen.current) return;
      const pending = suppressOutsideClick.current; suppressOutsideClick.current = false;
      if ((!ownsEvents() && !pending) || !outside(event)) return;
      stop(event); close();
    };
    const pointerfinish = (event: Event) => {
      if (childOpen.current) return;
      if ((ownsEvents() || suppressOutsideClick.current) && outside(event)) stop(event);
      if (event.type === "pointercancel") suppressOutsideClick.current = false;
    };
    const keydown = (event: KeyboardEvent) => {
      if (!ownsEvents()) return;
      if (event.key === "Escape") { stop(event); close(); }
      else if (event.key === "Tab") {
        stop(event);
        const buttons = openNow.current ? [...shell.current!.querySelectorAll<HTMLButtonElement>("button:not([disabled])")] : [trigger.current!];
        const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = current < 0 ? (event.shiftKey ? buttons.length - 1 : 0)
          : (current + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
        buttons[next]?.focus({ preventScroll: true });
      }
    };
    const focusin = (event: Event) => {
      if (ownsEvents() && outside(event)) trigger.current?.focus({ preventScroll: true });
    };
    const dismiss = (event: Event) => {
      if (!ownsEvents()) return;
      const scope = (event as CustomEvent<HTMLElement | null>).detail;
      if (scope && scope !== shell.current?.closest(".app-shell")) return;
      event.preventDefault(); close();
    };
    document.addEventListener("pointerdown", pointerdown, true); document.addEventListener("click", click, true);
    document.addEventListener("pointerup", pointerfinish, true); document.addEventListener("pointercancel", pointerfinish, true);
    document.addEventListener("keydown", keydown, true); document.addEventListener("focusin", focusin, true);
    document.addEventListener(dismissEvent, dismiss);
    return () => {
      document.removeEventListener("pointerdown", pointerdown, true); document.removeEventListener("click", click, true);
      document.removeEventListener("pointerup", pointerfinish, true); document.removeEventListener("pointercancel", pointerfinish, true);
      document.removeEventListener("keydown", keydown, true); document.removeEventListener("focusin", focusin, true);
      document.removeEventListener(dismissEvent, dismiss);
    };
  }, [close]);

  useEffect(() => {
    openNow.current = false; presentNow.current = false; suppressOutsideClick.current = false;
    setOpen(false); setPresent(false);
  }, [sceneId]);

  return (
    <div className="feedback-controls-anchor" data-feedback-present={present || undefined}>
      <div className="feedback-controls" ref={shell} data-open={open} data-haptics={canHaptic || undefined}
        data-reduced-motion={reducedMotion || undefined} role={open ? "dialog" : "group"}
        aria-modal={open || undefined} aria-label="仪式设置"
        onTransitionEnd={event => {
          if (event.target === event.currentTarget && event.propertyName === "height") finishClosing();
        }}>
        <button type="button" className="feedback-controls-trigger" ref={trigger} aria-label="仪式设置"
          aria-haspopup="dialog" aria-expanded={open} aria-pressed={open} aria-controls={optionsId}
          title={open ? "收起仪式设置" : "展开仪式设置"}
          onClick={() => {
            if (openNow.current) close();
            else {
              openNow.current = true; presentNow.current = true; setPresent(true); setOpen(true);
              trigger.current?.focus({ preventScroll: true });
            }
          }}><Icon name="gear" /></button>
        <div id={optionsId} className="feedback-controls-options" role="group" aria-label="体验反馈"
          aria-hidden={!open} inert={!open}>
          {([
            ["sound", "音效"],
            ["haptics", "震动"],
          ] as const)
            .filter(([key]) => key !== "haptics" || canHaptic)
            .map(([key, label]) => (
              <button key={key} type="button" aria-label={label} aria-pressed={state.settings[key]}
                title={`${label}已${state.settings[key] ? "开启" : "关闭"}`}
                onClick={() => dispatch({ type: "settings", key, value: !state.settings[key] })}>
                <Icon name={state.settings[key] ? key : `${key}-off`} />
              </button>
            ))}
          <VisualStyleControl key={sceneId} sceneId={sceneId} onOpenChange={onChildOpenChange} />
        </div>
      </div>
    </div>
  );
}
