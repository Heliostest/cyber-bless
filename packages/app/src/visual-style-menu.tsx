import { translate as tr } from '@wbr/i18n';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { visualStyleOptions, styleParameterControls, DEFAULT_STYLE_PARAMETERS, normalizeStyleParameters, getSceneVisualPreference, type VisualStylePreference, type VisualStyleId, } from "@wbr/core/visual-style";
import { sceneStyles, type DebugScene } from "@wbr/scene-runtime/debug-styles";
import { useApp } from "./context";
import { Icon } from "./art";
import { useVisualStyleThumbnails } from "./visual-style-thumbnails";
const dismissEvent = "wbr:close-visual-style";
/** Native Android back consumes an open menu before changing the App route. */
export function dismissVisualStyleMenu(scope?: HTMLElement | null) {
    return !document.dispatchEvent(new CustomEvent(dismissEvent, { cancelable: true, detail: scope }));
}
const order: VisualStyleId[] = ["toon-soft", "original", "gouache", "moebius", "toon-outline", "halftone", "pixel-art", "toon-ink",
    "gallery-toon", "pencil-hatch", "height-palette", "normal-palette", "sketch-contour", "gallery-outline", "space-grade", "depth-rim"];
const emptyScenes: DebugScene[] = [];
type ApplyScope = "current" | "all";
const openMenus: HTMLElement[] = [];
let scrollLocks = 0, originalBodyOverflow = "", ownsBodyScroll = false;
function lockBodyScroll() {
    if (scrollLocks++ === 0) {
        originalBodyOverflow = document.body.style.overflow;
        ownsBodyScroll = originalBodyOverflow !== "hidden";
        if (ownsBodyScroll)
            document.body.style.overflow = "hidden";
    }
    return () => {
        if (--scrollLocks === 0 && ownsBodyScroll)
            document.body.style.overflow = originalBodyOverflow;
    };
}
export function VisualStyleControl({ sceneId, onOpenChange }: {
    sceneId?: string;
    onOpenChange?(open: boolean): void;
}) {
    const scenes = useSyncExternalStore(sceneStyles.subscribe, sceneStyles.getSnapshot, () => emptyScenes);
    const [scope, setScope] = useState<HTMLElement>();
    const scene = scenes.find(item => item.id === sceneId && item.scope === scope);
    const anchor = useRef<HTMLSpanElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const [target, setTarget] = useState<HTMLElement | null>(null);
    const notify = useRef(onOpenChange);
    notify.current = onOpenChange;
    useEffect(() => () => notify.current?.(false), []);
    useEffect(() => { setScope(anchor.current?.closest<HTMLElement>(".app-shell") ?? undefined); }, []);
    useLayoutEffect(() => {
        if (scene || !target)
            return;
        // Losing the renderer removes the portal without unmounting this control.
        notify.current?.(false);
        setTarget(null);
    }, [scene, target]);
    return <span className="visual-style-anchor" ref={anchor}>{scene && <>
    <button type="button" aria-label={tr("\u89C6\u89C9\u98CE\u683C")} title={tr("\u89C6\u89C9\u98CE\u683C")} aria-haspopup="dialog" aria-expanded={!!target} onClick={() => {
                sceneStyles.cancelInput(scene.id, scene.scope);
                sceneStyles.clearDebugOverride(scene.id);
                // The portal focuses itself on mount; its parent must yield capture first.
                notify.current?.(true);
                setTarget(trigger.current?.closest<HTMLElement>(".app-shell") ?? document.body);
            }} ref={trigger}><Icon name="visual"/></button>
    {target && createPortal(<VisualStyleMenu scene={scene} shell={target} trigger={trigger.current} onClose={() => { notify.current?.(false); setTarget(null); }}/>, target)}
  </>}</span>;
}
function VisualStyleMenu({ scene, shell, trigger, onClose }: {
    scene: DebugScene;
    shell: HTMLElement;
    trigger: HTMLButtonElement | null;
    onClose(): void;
}) {
    const { state, dispatch } = useApp();
    const [choice, setChoice] = useState<VisualStylePreference | null>(getSceneVisualPreference(state, scene.id) ?? null);
    const [tuning, setTuning] = useState(false);
    const [previewing, setPreviewing] = useState(false);
    const [appliedScope, setAppliedScope] = useState<ApplyScope>("current");
    const current = useRef(choice);
    const changed = useRef(false), resetting = useRef(false);
    const preview = useRef<ReturnType<typeof sceneStyles.connectUserPreference> | null>(null);
    const panel = useRef<HTMLElement>(null), backdrop = useRef<HTMLDivElement>(null);
    const filmstrip = useRef<HTMLDivElement>(null);
    const drag = useRef<{ pointerId: number; x: number; left: number; moved: boolean } | null>(null);
    const suppressClick = useRef(false);
    const selected = choice?.style ?? scene.defaultStyle;
    const parameters = choice?.parameters ?? DEFAULT_STYLE_PARAMETERS;
    const thumbnails = useVisualStyleThumbnails(scene, parameters);
    const controls = styleParameterControls.filter(control => control.style === selected);
    const actualLabel = visualStyleOptions.find(option => option.id === scene.actual)?.label;
    function centerCard(card: HTMLElement, animate = false) {
        const strip = filmstrip.current;
        if (!strip || !strip.clientWidth)
            return;
        const left = card.offsetLeft + card.offsetWidth / 2 - strip.clientWidth / 2;
        const reducedMotion = state.settings.reducedMotion || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        strip.scrollTo({ left, behavior: animate && !reducedMotion ? "smooth" : "instant" });
    }
    useLayoutEffect(() => {
        if (tuning || previewing)
            return;
        const card = filmstrip.current?.querySelector<HTMLElement>(`[data-style="${selected}"]`);
        if (card)
            centerCard(card);
    // Selecting the center must never pull a moving strip back to that card.
    }, [tuning, previewing]);
    function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
        const currentDrag = drag.current;
        if (!currentDrag || currentDrag.pointerId !== event.pointerId)
            return;
        drag.current = null;
        event.currentTarget.classList.remove("is-dragging");
        if (event.currentTarget.hasPointerCapture?.(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
    }
    function apply(value: VisualStylePreference | null, reset = false) {
        if (value?.style !== current.current?.style)
            setTuning(false);
        changed.current = true;
        resetting.current = reset;
        current.current = value;
        setChoice(value);
        preview.current?.update(value);
    }
    function previewStyle(id: VisualStyleId) {
        if (id === (current.current?.style ?? scene.defaultStyle))
            return;
        apply({ style: id, parameters: current.current?.parameters ?? { ...scene.parameters } });
    }
    function previewCenter() {
        const strip = filmstrip.current;
        if (!strip || !strip.clientWidth)
            return;
        const center = strip.scrollLeft + strip.clientWidth / 2;
        let nearest: HTMLButtonElement | undefined, distance = Infinity;
        for (const card of strip.querySelectorAll<HTMLButtonElement>("button[data-style]")) {
            const next = Math.abs(card.offsetLeft + card.offsetWidth / 2 - center);
            if (next < distance) {
                nearest = card;
                distance = next;
            }
        }
        if (nearest)
            previewStyle(nearest.dataset.style as VisualStyleId);
    }
    function save() {
        if (!tuning && !previewing)
            previewCenter();
        if (changed.current || appliedScope === "all") {
            // Resetting locally must bypass an inherited global preference.
            const value = resetting.current
                ? appliedScope === "current" && state.globalVisualStyle
                    ? { style: scene.defaultStyle, parameters: { ...DEFAULT_STYLE_PARAMETERS } } : null
                : current.current ?? { style: scene.defaultStyle, parameters: { ...scene.parameters } };
            const stored = appliedScope === "all" ? state.globalVisualStyle
                : resetting.current ? state.visualStyles?.[scene.id] : getSceneVisualPreference(state, scene.id);
            const unchanged = value === null ? !stored : stored?.style === value.style
                && styleParameterControls.every(control => stored.parameters[control.key] === value.parameters[control.key]);
            const clearsOverrides = appliedScope === "all" && Object.keys(state.visualStyles ?? {}).length > 0;
            // App dispatch returns false for a legitimate no-op as well as a failure.
            if (!unchanged || clearsOverrides) {
                const saved = appliedScope === "all"
                    ? dispatch({ type: "scene.visual.all", ...(value ?? { style: null }) })
                    : dispatch({ type: "scene.visual", id: scene.id, ...(value ?? { style: null }) });
                if (!saved)
                    return;
            }
        }
        onClose();
    }
    useEffect(() => {
        const connection = sceneStyles.connectUserPreference(scene.id, current.current, undefined, scene.scope);
        preview.current = connection;
        return () => {
            // The temporary owner is the entire draft; disposal restores the save.
            connection.dispose();
            preview.current = null;
        };
    }, [scene.id]);
    useEffect(() => {
        const element = panel.current!;
        openMenus.push(element);
        const hidden = [...shell.children].filter(child => child !== backdrop.current).map(child => {
            const html = child as HTMLElement;
            const old = { element: html, inert: html.inert, aria: html.getAttribute("aria-hidden") };
            html.inert = true;
            html.setAttribute("aria-hidden", "true");
            return old;
        });
        const oldOverflow = shell.style.overflow, unlockBody = lockBodyScroll();
        shell.style.overflow = "hidden";
        const position = () => {
            const box = shell.getBoundingClientRect();
            backdrop.current?.style.setProperty("--visual-center", `${box.left + box.width / 2}px`);
        };
        position();
        window.addEventListener("resize", position);
        const focusables = () => [...element.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), summary, [tabindex="0"]')]
            .filter(item => !item.closest('[hidden]') && (!item.closest('details:not([open])') || item.tagName === "SUMMARY"));
        const keydown = (event: KeyboardEvent) => {
            if (openMenus.at(-1) !== element)
                return;
            if (event.key === "Escape") {
                event.preventDefault();
                onClose();
            }
            if (event.key === "Tab") {
                const all = focusables(), first = all[0], last = all.at(-1);
                if (event.shiftKey && (document.activeElement === first || !element.contains(document.activeElement))) {
                    event.preventDefault();
                    last?.focus();
                }
                else if (!event.shiftKey && (document.activeElement === last || !element.contains(document.activeElement))) {
                    event.preventDefault();
                    first?.focus();
                }
            }
        };
        const dismiss = (event: Event) => {
            const scope = (event as CustomEvent<HTMLElement | null>).detail;
            if (scope && scope !== shell)
                return;
            event.preventDefault();
            onClose();
        };
        document.addEventListener("keydown", keydown);
        document.addEventListener(dismissEvent, dismiss);
        element.querySelector<HTMLButtonElement>("[data-visual-style-close]")?.focus();
        return () => {
            const index = openMenus.indexOf(element);
            if (index >= 0)
                openMenus.splice(index, 1);
            document.removeEventListener("keydown", keydown);
            document.removeEventListener(dismissEvent, dismiss);
            window.removeEventListener("resize", position);
            for (const old of hidden) {
                old.element.inert = old.inert;
                if (old.aria === null)
                    old.element.removeAttribute("aria-hidden");
                else
                    old.element.setAttribute("aria-hidden", old.aria);
            }
            shell.style.overflow = oldOverflow;
            unlockBody();
            const remaining = openMenus.at(-1);
            if (remaining)
                remaining.querySelector<HTMLButtonElement>("[data-visual-style-close]")?.focus();
            else if (trigger?.isConnected)
                trigger.focus();
        };
    }, [shell]);
    return <div className={`visual-style-backdrop${previewing ? " is-previewing" : ""}`} ref={backdrop} onClick={event => {
            if (event.target === event.currentTarget)
                onClose();
        }}>
    <section className="visual-style-menu" role="dialog" aria-modal="true" aria-label={tr("\u89C6\u89C9\u98CE\u683C")} ref={panel}>
      <div className="visual-style-editor">
      <header className="visual-style-heading" hidden={previewing}><div><h2><span className="visual-style-emblem" aria-hidden="true"><Icon name="visual"/></span>{tr("\u89C6\u89C9\u98CE\u683C")}</h2><p>{tr("\u4E3A\u300C")}{tr(scene.label)}{tr("\u300D\u9009\u4E00\u79CD\u559C\u6B22\u7684\u753B\u9762")}</p></div>
        <button type="button" className="round-button" data-visual-style-close="" aria-label={tr("\u5173\u95ED\u89C6\u89C9\u98CE\u683C")} onClick={onClose}><Icon name="close"/></button></header>
      <div className="visual-style-body" hidden={previewing}>
        <div className="visual-style-grid visual-style-filmstrip" ref={filmstrip} role="group" aria-label={tr("\u9009\u62E9\u89C6\u89C9\u98CE\u683C")} hidden={tuning && controls.length > 0} onScroll={previewCenter}
          onPointerDown={event => {
                suppressClick.current = false;
                if (event.pointerType !== "mouse" || event.button !== 0 || event.currentTarget.scrollWidth <= event.currentTarget.clientWidth)
                    return;
                drag.current = { pointerId: event.pointerId, x: event.clientX, left: event.currentTarget.scrollLeft, moved: false };
            }}
          onPointerMove={event => {
                const currentDrag = drag.current;
                if (!currentDrag || currentDrag.pointerId !== event.pointerId)
                    return;
                if (!(event.buttons & 1)) {
                    endDrag(event);
                    return;
                }
                const delta = event.clientX - currentDrag.x;
                if (!currentDrag.moved && Math.abs(delta) < 6)
                    return;
                if (!currentDrag.moved) {
                    currentDrag.moved = true;
                    suppressClick.current = true;
                    event.currentTarget.classList.add("is-dragging");
                    event.currentTarget.setPointerCapture?.(event.pointerId);
                }
                event.preventDefault();
                event.currentTarget.scrollLeft = currentDrag.left - delta;
            }}
          onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}
          onClickCapture={event => {
                if (suppressClick.current && event.detail !== 0) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            }}
          onKeyDown={event => {
                const cards = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-style]")];
                const index = cards.indexOf(document.activeElement as HTMLButtonElement);
                if (index < 0)
                    return;
                const next = event.key === "ArrowRight" ? Math.min(index + 1, cards.length - 1)
                    : event.key === "ArrowLeft" ? Math.max(index - 1, 0)
                    : event.key === "Home" ? 0 : event.key === "End" ? cards.length - 1 : null;
                if (next !== null) {
                    event.preventDefault();
                    cards[next].focus({ preventScroll: true });
                    previewStyle(cards[next].dataset.style as VisualStyleId);
                    centerCard(cards[next], true);
                }
            }}>
          {order.map(id => {
            const option = visualStyleOptions.find(item => item.id === id)!;
            return <button key={id} data-style={id} type="button" aria-pressed={id === selected} onFocus={event => {
                    // Pointer focus must not move a card between press and release.
                    if (event.currentTarget.matches(":focus-visible")) {
                        previewStyle(id);
                        centerCard(event.currentTarget, true);
                    }
                }} onClick={event => { previewStyle(id); centerCard(event.currentTarget, true); }}>
              <span className="visual-style-swatch" aria-hidden="true" data-preview-state={thumbnails[id] ? "ready" : thumbnails[id] === null ? "unavailable" : "loading"}>
                {thumbnails[id] ? <img src={thumbnails[id]!} alt="" width="160" height="120" decoding="async" draggable={false}/> : <Icon name="visual"/>}
              </span>
              <span><strong>{tr(option.label)}</strong><small>{id === scene.defaultStyle ? tr("\u9ED8\u8BA4\u753B\u9762") : tr(option.detail)}</small></span>
              <span className="visual-style-check" aria-hidden="true">{id === selected ? "✓" : ""}</span>
            </button>;
        })}
        </div>
        <div className="visual-style-scope" role="group" aria-label={tr("\u5E94\u7528\u89C6\u89C9\u98CE\u683C")}>
          <button type="button" className="visual-style-scope-current" aria-pressed={appliedScope === "current"} onClick={() => setAppliedScope("current")}>{tr("\u4EC5\u5F53\u524D\u4EEA\u5F0F")}</button>
          <button type="button" className="visual-style-scope-all" aria-pressed={appliedScope === "all"} onClick={() => setAppliedScope("all")}>{tr("\u5E94\u7528\u5230\u5168\u90E8\u4EEA\u5F0F")}</button>
        </div>
        {controls.length > 0 && <details className="visual-style-tuning" key={selected} open={tuning} onToggle={event => setTuning(event.currentTarget.open)}>
          <summary>{tuning ? tr("\u6536\u8D77\u5FAE\u8C03\uFF0C\u8FD4\u56DE\u98CE\u683C") : tr("\u5FAE\u8C03\u6548\u679C")}</summary>
          {controls.map(control => {
                const value = parameters[control.key], formatted = control.unit === "%" ? `${Math.round(value * 100)}%` : `${value} ${control.unit}`;
                return <div className="visual-style-parameter" key={control.key}>
              <div><label htmlFor={`visual-${control.key}`}>{tr(control.label)}</label><output htmlFor={`visual-${control.key}`}>{formatted}</output></div>
              <input id={`visual-${control.key}`} type="range" min={control.min} max={control.max} step={control.step} value={value} aria-valuetext={formatted} onChange={event => apply({ style: selected, parameters: normalizeStyleParameters({ [control.key]: Number(event.target.value) }, current.current?.parameters) })}/>
            </div>;
            })}
          <button type="button" className="small-button visual-style-reset-parameters" onClick={() => {
                const next = { ...parameters };
                for (const control of controls)
                    next[control.key] = DEFAULT_STYLE_PARAMETERS[control.key];
                apply({ style: selected, parameters: next });
            }}>{tr("\u91CD\u7F6E\u53C2\u6570")}</button>
        </details>}
        <p className="visual-style-status" role="status" data-expanded={scene.actual !== selected || undefined}>{scene.actual !== selected ? tr("\u8FD9\u4E2A\u6548\u679C\u6682\u65F6\u65E0\u6CD5\u663E\u793A\uFF0C\u5DF2\u4F7F\u7528{p0}\u3002", { p0: actualLabel }) : tr("\u5F53\u524D\u98CE\u683C\uFF1A{p0}", { p0: tr(visualStyleOptions.find(option => option.id === selected)!.label) })}</p>
      </div>
      <footer><button type="button" className="button outline" onClick={() => {
                apply(null, true);
                const card = filmstrip.current?.querySelector<HTMLElement>(`[data-style="${scene.defaultStyle}"]`);
                if (card)
                    centerCard(card);
            }} disabled={choice === null && !state.globalVisualStyle && !Object.keys(state.visualStyles ?? {}).length} hidden={previewing}>{tr("\u6062\u590D\u9ED8\u8BA4")}</button>
        <button type="button" className="button secondary" aria-pressed={previewing} onClick={() => setPreviewing(value => !value)}>{previewing ? tr("\u7EE7\u7EED\u8C03\u6574") : tr("\u770B\u753B\u9762")}</button>
        <button type="button" className="button primary visual-style-done" onClick={save}>{tr("\u5B8C\u6210")}</button></footer>
      </div>
    </section>
  </div>;
}
