import { translate as tr } from '@wbr/i18n';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { visualStyleOptions, styleParameterControls, DEFAULT_STYLE_PARAMETERS, normalizeStyleParameters, getSceneVisualPreference, type VisualStylePreference, type VisualStyleId, } from "@wbr/core/visual-style";
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
type ApplyScope = "current" | "all";
type Confirmation = {
    value: VisualStylePreference | null;
    trigger: HTMLElement;
};
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
    const { state, dispatch, active } = useApp();
    const [choice, setChoice] = useState<VisualStylePreference | null>(getSceneVisualPreference(state, scene.id) ?? null);
    const [tuning, setTuning] = useState(false);
    const [previewing, setPreviewing] = useState(false);
    const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
    const [appliedScope, setAppliedScope] = useState<ApplyScope>("current");
    const confirming = useRef(confirmation);
    confirming.current = confirmation;
    const focusReturn = useRef<HTMLElement | null>(null);
    const current = useRef(choice), latestDispatch = useRef(dispatch);
    latestDispatch.current = dispatch;
    const preview = useRef<ReturnType<typeof sceneStyles.connectUserPreference> | null>(null);
    const pending = useRef<{
        value: VisualStylePreference | null;
        scope: ApplyScope;
    } | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const panel = useRef<HTMLElement>(null), backdrop = useRef<HTMLDivElement>(null);
    const selected = choice?.style ?? scene.defaultStyle;
    const parameters = choice?.parameters ?? DEFAULT_STYLE_PARAMETERS;
    const controls = styleParameterControls.filter(control => control.style === selected);
    const actualLabel = visualStyleOptions.find(option => option.id === scene.actual)?.label;
    function flush() {
        clearTimeout(timer.current);
        const next = pending.current;
        pending.current = null;
        if (next) {
            if (next.scope === "all")
                latestDispatch.current({ type: "scene.visual.all", ...(next.value ?? { style: null }) });
            else
                latestDispatch.current({ type: "scene.visual", id: scene.id, ...(next.value ?? { style: null }) });
        }
    }
    function apply(value: VisualStylePreference | null, deferred = false, scope = appliedScope) {
        if (value?.style !== current.current?.style)
            setTuning(false);
        current.current = value;
        setChoice(value);
        preview.current?.update(value);
        pending.current = { value, scope };
        clearTimeout(timer.current);
        if (deferred)
            timer.current = setTimeout(flush, 180);
        else
            flush();
    }
    function requestChoice(value: VisualStylePreference | null, trigger: HTMLElement) {
        flush();
        setTuning(false);
        setChoice(value);
        preview.current?.update(value);
        setConfirmation({ value, trigger });
    }
    function cancelConfirmation() {
        const next = confirming.current;
        if (!next)
            return;
        focusReturn.current = next.trigger;
        setChoice(current.current);
        preview.current?.update(current.current);
        setConfirmation(null);
    }
    function confirmChoice(scope: ApplyScope) {
        if (!confirmation)
            return;
        // A local reset must bypass the global preference and restore this content default.
        const value = confirmation.value ?? (scope === "current" && state.globalVisualStyle
            ? { style: scene.defaultStyle, parameters: { ...DEFAULT_STYLE_PARAMETERS } } : null);
        focusReturn.current = confirmation.trigger;
        setConfirmation(null);
        setAppliedScope(scope);
        apply(value, false, scope);
    }
    useLayoutEffect(() => {
        if (confirmation)
            panel.current?.querySelector<HTMLButtonElement>(".visual-style-scope-current")?.focus();
        else if (focusReturn.current) {
            const target = focusReturn.current;
            if (target.isConnected && !target.matches(":disabled") && !target.closest("[hidden]"))
                target.focus();
            else
                panel.current?.querySelector<HTMLButtonElement>("[data-visual-style-close]")?.focus();
            focusReturn.current = null;
        }
    }, [confirmation]);
    useEffect(() => {
        const connection = sceneStyles.connectUserPreference(scene.id, current.current, undefined, scene.scope);
        preview.current = connection;
        const hidden = () => {
            if (document.hidden)
                flush();
        };
        document.addEventListener("visibilitychange", hidden, true);
        window.addEventListener("pagehide", flush, true);
        return () => {
            document.removeEventListener("visibilitychange", hidden, true);
            window.removeEventListener("pagehide", flush, true);
            flush();
            connection.dispose();
            preview.current = null;
        };
    }, [scene.id]);
    useEffect(() => {
        if (active === false)
            flush();
    }, [active]);
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
                if (confirming.current)
                    cancelConfirmation();
                else
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
            if (confirming.current)
                cancelConfirmation();
            else
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
            if (event.target === event.currentTarget) {
                if (confirmation)
                    cancelConfirmation();
                else
                    onClose();
            }
        }}>
    <section className="visual-style-menu" role="dialog" aria-modal="true" aria-label={confirmation ? tr("\u5E94\u7528\u89C6\u89C9\u98CE\u683C") : tr("\u89C6\u89C9\u98CE\u683C")} ref={panel}>
      <div hidden={!!confirmation} className="visual-style-editor">
      <header className="visual-style-heading" hidden={previewing}><div><h2><span className="visual-style-emblem" aria-hidden="true"><Icon name="visual"/></span>{tr("\u89C6\u89C9\u98CE\u683C")}</h2><p>{tr("\u4E3A\u300C")}{tr(scene.label)}{tr("\u300D\u9009\u4E00\u79CD\u559C\u6B22\u7684\u753B\u9762")}</p></div>
        <button type="button" className="round-button" data-visual-style-close="" aria-label={tr("\u5173\u95ED\u89C6\u89C9\u98CE\u683C")} onClick={onClose}><Icon name="close"/></button></header>
      <div className="visual-style-body" hidden={previewing}>
        <div className="visual-style-grid" role="group" aria-label={tr("\u9009\u62E9\u89C6\u89C9\u98CE\u683C")} hidden={tuning && controls.length > 0}>
          {order.map(id => {
            const option = visualStyleOptions.find(item => item.id === id)!;
            return <button key={id} data-style={id} type="button" aria-pressed={id === selected} onClick={event => requestChoice({ style: id, parameters: current.current?.parameters ?? { ...scene.parameters } }, event.currentTarget)}>
              <span className={`visual-style-swatch visual-style-swatch-${id}`} aria-hidden="true"/>
              <span><strong>{tr(option.label)}</strong><small>{id === scene.defaultStyle ? tr("\u9ED8\u8BA4\u753B\u9762") : tr(option.detail)}</small></span>
              <span className="visual-style-check" aria-hidden="true">{id === selected ? "✓" : ""}</span>
            </button>;
        })}
        </div>
        {controls.length > 0 && <details className="visual-style-tuning" key={selected} open={tuning} onToggle={event => setTuning(event.currentTarget.open)}>
          <summary>{tuning ? tr("\u6536\u8D77\u5FAE\u8C03\uFF0C\u8FD4\u56DE\u98CE\u683C") : tr("\u5FAE\u8C03\u6548\u679C")}</summary>
          {controls.map(control => {
                const value = parameters[control.key], formatted = control.unit === "%" ? `${Math.round(value * 100)}%` : `${value} ${control.unit}`;
                return <div className="visual-style-parameter" key={control.key}>
              <div><label htmlFor={`visual-${control.key}`}>{tr(control.label)}</label><output htmlFor={`visual-${control.key}`}>{formatted}</output></div>
              <input id={`visual-${control.key}`} type="range" min={control.min} max={control.max} step={control.step} value={value} aria-valuetext={formatted} onChange={event => apply({ style: selected, parameters: normalizeStyleParameters({ [control.key]: Number(event.target.value) }, current.current?.parameters) }, true)}/>
            </div>;
            })}
          <button type="button" className="small-button visual-style-reset-parameters" onClick={() => {
                const next = { ...parameters };
                for (const control of controls)
                    next[control.key] = DEFAULT_STYLE_PARAMETERS[control.key];
                apply({ style: selected, parameters: next });
            }}>{tr("\u91CD\u7F6E\u53C2\u6570")}</button>
        </details>}
        <p className="visual-style-status" role="status">{scene.actual !== selected ? tr("\u8FD9\u4E2A\u6548\u679C\u6682\u65F6\u65E0\u6CD5\u663E\u793A\uFF0C\u5DF2\u4F7F\u7528{p0}\u3002", { p0: actualLabel }) : appliedScope === "all" ? tr("\u5DF2\u7EDF\u4E00\u5168\u90E8\u4EEA\u5F0F\uFF0C\u7EE7\u7EED\u5FAE\u8C03\u4E5F\u4F1A\u5E94\u7528\u5230\u5168\u90E8\u3002") : tr("\u5FAE\u8C03\u4EC5\u4FEE\u6539\u5F53\u524D\u4EEA\u5F0F\uFF1B\u9009\u62E9\u98CE\u683C\u65F6\u53EF\u7EDF\u4E00\u5168\u90E8\u4EEA\u5F0F\u3002")}</p>
      </div>
      <footer><button type="button" className="button outline" onClick={event => requestChoice(null, event.currentTarget)} disabled={choice === null && !state.globalVisualStyle && !Object.keys(state.visualStyles ?? {}).length} hidden={previewing}>{tr("\u6062\u590D\u9ED8\u8BA4")}</button>
        <button type="button" className="button secondary" aria-pressed={previewing} onClick={() => setPreviewing(value => !value)}>{previewing ? tr("\u7EE7\u7EED\u8C03\u6574") : tr("\u770B\u753B\u9762")}</button>
        <button type="button" className="button primary visual-style-done" onClick={onClose}>{tr("\u5B8C\u6210")}</button></footer>
      </div>
      {confirmation && <div className="visual-style-scope">
        <h2>{confirmation.value ? tr("\u5E94\u7528\u5230\u54EA\u4E9B\u4EEA\u5F0F\uFF1F") : tr("\u6062\u590D\u54EA\u4E9B\u4EEA\u5F0F\uFF1F")}</h2>
        <p>{confirmation.value
                ? tr("\u5F53\u524D\u98CE\u683C\uFF1A{p0}", { p0: visualStyleOptions.find(option => option.id === confirmation.value?.style)?.label }) : tr("\u6062\u590D\u5404\u81EA\u7684\u9ED8\u8BA4\u753B\u9762\u3002")}</p>
        <p className="visual-style-scope-note">{confirmation.value ? tr("\u5168\u90E8\u5E94\u7528\u4F1A\u8986\u76D6\u5355\u72EC\u8BBE\u7F6E\u3002") : tr("\u5168\u90E8\u6062\u590D\u4F1A\u6E05\u9664\u5355\u72EC\u8BBE\u7F6E\u3002")}</p>
        <div className="visual-style-scope-actions">
          <button type="button" className="button secondary visual-style-scope-current" onClick={() => confirmChoice("current")}>{tr("\u4EC5\u5F53\u524D\u4EEA\u5F0F")}</button>
          <button type="button" className="button primary" onClick={() => confirmChoice("all")}>{tr("\u5E94\u7528\u5230\u5168\u90E8\u4EEA\u5F0F")}</button>
          <button type="button" className="text-button visual-style-scope-cancel" onClick={cancelConfirmation}>{tr("\u53D6\u6D88")}</button>
        </div>
      </div>}
    </section>
  </div>;
}
