import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  visualStyleOptions, styleParameterControls, DEFAULT_STYLE_PARAMETERS, normalizeStyleParameters,
  type VisualStylePreference, type VisualStyleId,
} from "@wbr/core/visual-style";
import { sceneStyles, type DebugScene } from "@wbr/scene-runtime/debug-styles";
import { useApp } from "./context";
import { Icon } from "./art";

const dismissEvent = "wbr:close-visual-style";
/** Native Android back consumes an open menu before changing the App route. */
export function dismissVisualStyleMenu(scope?: HTMLElement | null) {
  return !document.dispatchEvent(new CustomEvent(dismissEvent, { cancelable: true, detail: scope }));
}
const order: VisualStyleId[] = ["toon-soft", "original", "gouache", "moebius", "toon-outline", "halftone", "pixel-art", "toon-ink"];
const emptyScenes: DebugScene[] = [];
const openMenus: HTMLElement[] = [];
let scrollLocks = 0, originalBodyOverflow = "";
function lockBodyScroll() {
  if (scrollLocks++ === 0) { originalBodyOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; }
  return () => { if (--scrollLocks === 0) document.body.style.overflow = originalBodyOverflow; };
}

export function VisualStyleControl({ sceneId }: { sceneId?: string }) {
  const scenes = useSyncExternalStore(sceneStyles.subscribe, sceneStyles.getSnapshot, () => emptyScenes);
  const [scope, setScope] = useState<HTMLElement>();
  const scene = scenes.find(item => item.id === sceneId && item.scope === scope);
  const anchor = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => { setScope(anchor.current?.closest<HTMLElement>(".app-shell") ?? undefined); }, []);
  return <span className="visual-style-anchor" ref={anchor}>{scene && <>
    <button type="button" aria-label="视觉风格" title="视觉风格" aria-haspopup="dialog"
      aria-expanded={!!target} onClick={() => {
        sceneStyles.cancelInput(scene.id, scene.scope);
        sceneStyles.clearDebugOverride(scene.id);
        setTarget(trigger.current?.closest<HTMLElement>(".app-shell") ?? document.body);
      }} ref={trigger}><Icon name="visual" /></button>
    {target && createPortal(<VisualStyleMenu scene={scene} shell={target} trigger={trigger.current}
      onClose={() => setTarget(null)} />, target)}
  </>}</span>;
}

function VisualStyleMenu({ scene, shell, trigger, onClose }: {
  scene: DebugScene; shell: HTMLElement; trigger: HTMLButtonElement | null; onClose(): void;
}) {
  const { state, dispatch, active } = useApp();
  const [choice, setChoice] = useState<VisualStylePreference | null>(state.visualStyles?.[scene.id] ?? null);
  const [tuning, setTuning] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const current = useRef(choice), latestDispatch = useRef(dispatch);
  latestDispatch.current = dispatch;
  const preview = useRef<ReturnType<typeof sceneStyles.connectUserPreference> | null>(null);
  const pending = useRef<{ value: VisualStylePreference | null } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const panel = useRef<HTMLElement>(null), backdrop = useRef<HTMLDivElement>(null);
  const selected = choice?.style ?? scene.defaultStyle;
  const parameters = choice?.parameters ?? DEFAULT_STYLE_PARAMETERS;
  const controls = styleParameterControls.filter(control => control.style === selected);
  const actualLabel = visualStyleOptions.find(option => option.id === scene.actual)?.label;

  function flush() {
    clearTimeout(timer.current);
    const next = pending.current; pending.current = null;
    if (next) latestDispatch.current({ type: "scene.visual", id: scene.id,
      ...(next.value ? next.value : { style: null }) });
  }
  function apply(value: VisualStylePreference | null, deferred = false) {
    if (value?.style !== current.current?.style) setTuning(false);
    current.current = value; setChoice(value); preview.current?.update(value);
    pending.current = { value }; clearTimeout(timer.current);
    if (deferred) timer.current = setTimeout(flush, 180);
    else flush();
  }

  useEffect(() => {
    const connection = sceneStyles.connectUserPreference(scene.id, current.current, undefined, scene.scope);
    preview.current = connection;
    const hidden = () => { if (document.hidden) flush(); };
    document.addEventListener("visibilitychange", hidden, true);
    window.addEventListener("pagehide", flush, true);
    return () => {
      document.removeEventListener("visibilitychange", hidden, true); window.removeEventListener("pagehide", flush, true);
      flush(); connection.dispose(); preview.current = null;
    };
  }, [scene.id]);
  useEffect(() => { if (active === false) flush(); }, [active]);

  useEffect(() => {
    const element = panel.current!;
    openMenus.push(element);
    const hidden = [...shell.children].filter(child => child !== backdrop.current).map(child => {
      const html = child as HTMLElement;
      const old = { element: html, inert: html.inert, aria: html.getAttribute("aria-hidden") };
      html.inert = true; html.setAttribute("aria-hidden", "true"); return old;
    });
    const oldOverflow = shell.style.overflow, unlockBody = lockBodyScroll();
    shell.style.overflow = "hidden";
    const position = () => {
      const box = shell.getBoundingClientRect();
      backdrop.current?.style.setProperty("--visual-center", `${box.left + box.width/2}px`);
    };
    position(); window.addEventListener("resize", position);
    const focusables = () => [...element.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), summary, [tabindex="0"]')]
      .filter(item => !item.closest('[hidden]') && (!item.closest('details:not([open])') || item.tagName === "SUMMARY"));
    const keydown = (event: KeyboardEvent) => {
      if (openMenus.at(-1) !== element) return;
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key === "Tab") {
        const all = focusables(), first = all[0], last = all.at(-1);
        if (event.shiftKey && (document.activeElement === first || !element.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !element.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
      }
    };
    const dismiss = (event: Event) => {
      const scope = (event as CustomEvent<HTMLElement | null>).detail;
      if (scope && scope !== shell) return;
      event.preventDefault(); onClose();
    };
    document.addEventListener("keydown", keydown); document.addEventListener(dismissEvent, dismiss);
    element.querySelector<HTMLButtonElement>('button[aria-label="关闭视觉风格"]')?.focus();
    return () => {
      const index = openMenus.indexOf(element); if (index >= 0) openMenus.splice(index, 1);
      document.removeEventListener("keydown", keydown); document.removeEventListener(dismissEvent, dismiss);
      window.removeEventListener("resize", position);
      for (const old of hidden) {
        old.element.inert = old.inert;
        if (old.aria === null) old.element.removeAttribute("aria-hidden"); else old.element.setAttribute("aria-hidden", old.aria);
      }
      shell.style.overflow = oldOverflow; unlockBody();
      const remaining = openMenus.at(-1);
      if (remaining) remaining.querySelector<HTMLButtonElement>('button[aria-label="关闭视觉风格"]')?.focus();
      else if (trigger?.isConnected) trigger.focus();
    };
  }, [shell]);

  return <div className={`visual-style-backdrop${previewing ? " is-previewing" : ""}`} ref={backdrop} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="visual-style-menu" role="dialog" aria-modal="true" aria-label="视觉风格" ref={panel}>
      <header className="visual-style-heading" hidden={previewing}><div><h2><span className="visual-style-emblem" aria-hidden="true"><Icon name="visual" /></span>视觉风格</h2><p>为「{scene.label}」选一种喜欢的画面</p></div>
        <button type="button" className="round-button" aria-label="关闭视觉风格" onClick={onClose}><Icon name="close" /></button></header>
      <div className="visual-style-body" hidden={previewing}>
        <div className="visual-style-grid" role="group" aria-label="选择视觉风格" hidden={tuning && controls.length > 0}>
          {order.map(id => {
            const option = visualStyleOptions.find(item => item.id === id)!;
            return <button key={id} data-style={id} type="button" aria-pressed={id === selected}
              onClick={() => apply({ style: id, parameters: current.current?.parameters ?? { ...scene.parameters } })}>
              <span className={`visual-style-swatch visual-style-swatch-${id}`} aria-hidden="true" />
              <span><strong>{option.label}</strong><small>{id === scene.defaultStyle ? "默认画面" : option.detail}</small></span>
              <span className="visual-style-check" aria-hidden="true">{id === selected ? "✓" : ""}</span>
            </button>;
          })}
        </div>
        {controls.length > 0 && <details className="visual-style-tuning" key={selected} open={tuning} onToggle={event => setTuning(event.currentTarget.open)}>
          <summary>{tuning ? "收起微调，返回风格" : "微调效果"}</summary>
          {controls.map(control => {
            const value = parameters[control.key], formatted = control.unit === "%" ? `${Math.round(value*100)}%` : `${value} ${control.unit}`;
            return <div className="visual-style-parameter" key={control.key}>
              <div><label htmlFor={`visual-${control.key}`}>{control.label}</label><output htmlFor={`visual-${control.key}`}>{formatted}</output></div>
              <input id={`visual-${control.key}`} type="range" min={control.min} max={control.max} step={control.step} value={value} aria-valuetext={formatted}
                onChange={event => apply({ style: selected, parameters: normalizeStyleParameters({ [control.key]: Number(event.target.value) }, current.current?.parameters) }, true)} />
            </div>;
          })}
          <button type="button" className="small-button visual-style-reset-parameters" onClick={() => {
            const next = { ...parameters };
            for (const control of controls) next[control.key] = DEFAULT_STYLE_PARAMETERS[control.key];
            apply({ style: selected, parameters: next });
          }}>重置参数</button>
        </details>}
        <p className="visual-style-status" role="status">{scene.actual !== selected ? `这个效果暂时无法显示，已使用${actualLabel}。` : "只记住这个仪式的选择，随时可以更换。"}</p>
      </div>
      <footer><button type="button" className="button outline" onClick={() => apply(null)} disabled={choice === null} hidden={previewing}>恢复默认</button>
        <button type="button" className="button secondary" aria-pressed={previewing} onClick={() => setPreviewing(value => !value)}>{previewing ? "继续调整" : "看画面"}</button>
        <button type="button" className="button primary visual-style-done" onClick={onClose}>完成</button></footer>
    </section>
  </div>;
}
