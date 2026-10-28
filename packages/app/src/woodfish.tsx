import { translate as tr, translateScene, hasProductCopy } from '@wbr/i18n';
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { SceneLoadFailure } from "./scene-load-failure";
import { mountScene, type SceneSession } from "@wbr/scene-runtime";
import { sceneEngines, type WoodfishController, type WoodfishContext, } from "./scene-engines";
import { pressOutcome } from "./woodfish-input";
import { useContent, woodfishContent } from "./content";
import { useApp } from "./context";
import { useSceneVisualPreference } from "./scene-visual-preference";
export function Woodfish({ active, reducedMotion, view, disabled, onStrike, onImpact, onInstruction, contentClient, sceneId, onFailure, whenIdleRef, strikes = 0, minimumStrikes = 12, instruction = "\u8F7B\u70B9\u6728\u9C7C\u6572\u4E00\u4E0B\uFF1B\u6309\u4F4F\u62D6\u52A8\uFF0C\u6728\u69CC\u4F1A\u8DDF\u7740\u79FB\u52A8\u3002", onFinish, }: {
    active: boolean;
    reducedMotion: boolean;
    view: string;
    disabled: boolean;
    onStrike(): boolean;
    onImpact(sound?: AudioBuffer): void;
    onInstruction(text: string): void;
    contentClient?: WoodfishContext["content"];
    sceneId?: string;
    onFailure?(error?: unknown): void;
    /** Set while the scene lives, so a ritual can wait out the mallet. */
    whenIdleRef?: {
        current: (() => Promise<void>) | null;
    };
    strikes?: number;
    minimumStrikes?: number;
    instruction?: string;
    onFinish?(): void;
}) {
    const host = useRef<HTMLDivElement>(null);
    const scene = useRef<SceneSession<WoodfishController> | null>(null);
    useSceneVisualPreference(sceneId ?? "woodfish", () => {
        gesture.current = null;
        suppressClick.current = true;
        latest.current.stopInteractionSound?.();
        scene.current?.setActive(false);
        scene.current?.setActive(active);
    }, host);
    const environment = useContent();
    const { decodeSound, stopInteractionSound } = useApp();
    const latest = useRef({ active, reducedMotion, onImpact, stopInteractionSound });
    latest.current = { active, reducedMotion, onImpact, stopInteractionSound };
    const gesture = useRef<{
        id: number;
        x: number;
        y: number;
        distance: number;
        at: number;
        type: string;
        cancelled: boolean;
    } | null>(null);
    const suppressClick = useRef(false);
    const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
    const [attempt, setAttempt] = useState(0);
    const [error, setError] = useState("");
    useEffect(() => {
        let disposed = false;
        if (!host.current)
            return;
        gesture.current = null;
        suppressClick.current = true;
        setStatus("loading");
        setError("");
        scene.current = mountScene<WoodfishContext, WoodfishController>({
            host: host.current,
            load: () => sceneEngines.load("woodfish@1"),
            context: {
                content: contentClient ?? woodfishContent(environment),
                sceneId,
                decodeSound,
                onInstruction,
                impact: (sound) => { if (latest.current.active) latest.current.onImpact(sound); },
            },
            active: latest.current.active,
            reducedMotion: latest.current.reducedMotion,
            ready: () => {
                if (!disposed)
                    setStatus("ready");
            },
            failed: (error) => {
                if (!disposed) {
                    latest.current.stopInteractionSound?.();
                    gesture.current = null;
                    suppressClick.current = true;
                    setStatus("failed");
                    setError(error instanceof Error ? error.message : "\u573A\u666F\u753B\u9762\u6682\u4E0D\u53EF\u7528");
                }
                if (!disposed)
                    onFailure?.(error);
            },
        });
        // The controller arrives once the engine loads; read it lazily each call.
        if (whenIdleRef)
            whenIdleRef.current = () => scene.current?.controller?.whenIdle?.() ?? Promise.resolve();
        return () => {
            disposed = true;
            latest.current.stopInteractionSound?.();
            if (whenIdleRef)
                whenIdleRef.current = null;
            scene.current?.dispose();
            scene.current = null;
        };
    }, [attempt]);
    useEffect(() => {
        scene.current?.setActive(active);
        if (!active) latest.current.stopInteractionSound?.();
    }, [active]);
    useEffect(() => {
        if (!active || disabled) {
            gesture.current = null;
            suppressClick.current = true;
            scene.current?.controller?.stopFollowing();
        }
    }, [active, disabled]);
    useEffect(() => scene.current?.setReducedMotion(reducedMotion), [reducedMotion]);
    useEffect(() => scene.current?.controller?.inspect(view), [view, status]);
    function move(event: PointerEvent<HTMLButtonElement>) {
        if (disabled || !active || status !== "ready")
            return;
        const g = gesture.current;
        if (g && g.id === event.pointerId)
            g.distance = Math.max(g.distance, Math.hypot(event.clientX - g.x, event.clientY - g.y));
        if (event.pointerType !== "mouse" && (!g || g.id !== event.pointerId))
            return;
        const rect = event.currentTarget.getBoundingClientRect();
        scene.current?.controller?.movePointer(((event.clientX - rect.left) / rect.width) * 2 - 1, 1 - ((event.clientY - rect.top) / rect.height) * 2, event.pointerType !== "mouse");
    }
    function cancelPointer(event: PointerEvent<HTMLButtonElement>) {
        if (gesture.current?.id !== event.pointerId)
            return;
        gesture.current = null;
        suppressClick.current = true;
        scene.current?.controller?.stopFollowing();
    }
    /** A strike only counts while its real 3D controller can swing the mallet. */
    function strike() {
        const controller = scene.current?.controller;
        if (disabled || !active || status !== "ready" || !controller)
            return;
        if (!onStrike())
            return;
        controller.strike();
    }
    const canFinish = strikes >= minimumStrikes && !disabled && !!onFinish;
    const hint = status === "loading" ? tr("\u6B63\u5728\u5E03\u7F6E\u5C0F\u5929\u5730\u2026") : disabled ? tr("\u672C\u8F6E\u8F7B\u6572\u5DF2\u7ED3\u675F") : !active ? tr("\u505C\u4E00\u4F1A\u513F\uFF0C\u4E5F\u5F88\u597D\u3002") : canFinish ? tr("\u53EF\u4EE5\u7EE7\u7EED\u8F7B\u6572\uFF0C\u60F3\u6536\u5C3E\u65F6\u70B9\u300C\u7ED3\u675F\u4EEA\u5F0F\u300D\u3002") : translateScene(instruction);
    return (<>
    <div ref={host} className="library-scene-stage woodfish-stage woodfish-visual" data-scene={sceneId ?? "woodfish"} data-stage="day" data-renderer={status} data-ready={status === "ready" ? "true" : undefined} hidden={status === "failed"}>
    <div className="scene-overlay-host scene-overlay scene-overlay--stage" inert={!active || disabled || status !== "ready"}>
    <button type="button" className="scene-hit-layer woodfish-object" aria-label={disabled ? tr("\u672C\u8F6E\u8F7B\u6572\u5DF2\u7ED3\u675F") : tr("\u8F7B\u6572\u6728\u9C7C")} disabled={disabled || !active || status !== "ready"} aria-describedby="woodfish-instruction" onPointerDown={(event) => {
            if (!event.isPrimary) {
                if (gesture.current)
                    gesture.current.cancelled = true;
                return;
            }
            if (disabled || !active || status !== "ready" || event.button !== 0 || gesture.current)
                return;
            suppressClick.current = false;
            gesture.current = {
                id: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                distance: 0,
                at: performance.now(),
                type: event.pointerType,
                cancelled: false,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
            move(event);
        }} onPointerMove={move} onPointerUp={(event) => {
            const g = gesture.current;
            if (!g || g.id !== event.pointerId)
                return;
            g.distance = Math.max(g.distance, Math.hypot(event.clientX - g.x, event.clientY - g.y));
            const press = pressOutcome({
                distance: g.distance,
                elapsed: g.type === "mouse" ? 0 : performance.now() - g.at,
                cancelled: g.cancelled,
            });
            // A quick tap strikes through the click that follows. A long still
            // press strikes now, and any click the browser still sends is dropped.
            suppressClick.current = press !== "tap";
            gesture.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId);
            if (g.type !== "mouse")
                scene.current?.controller?.stopFollowing();
            if (press === "long")
                strike();
        }} onPointerCancel={cancelPointer} onLostPointerCapture={cancelPointer} onPointerLeave={() => {
            if (!gesture.current)
                scene.current?.controller?.stopFollowing();
        }} onContextMenu={(event) => {
            event.preventDefault();
            // Android sends this while a finger is held down: no menu, and the
            // press still strikes when it lifts. A right click just stops.
            if (gesture.current && gesture.current.type !== "mouse")
                return;
            gesture.current = null;
            suppressClick.current = true;
            scene.current?.controller?.stopFollowing();
        }} onDragStart={(event) => event.preventDefault()} onClick={(event) => {
            if (event.button !== 0 || (event.detail !== 0 && suppressClick.current))
                return;
            strike();
        }}/>
    <p id="woodfish-instruction" className="scene-hint" lang={status === "ready" && !disabled && active && !canFinish && !hasProductCopy(instruction) ? "und" : undefined} aria-live="polite" data-ready={canFinish ? "true" : undefined} data-progress={status === "loading" || !active || disabled ? "true" : undefined}>{hint}</p>
    <div className="scene-step-dots woodfish-count" aria-hidden="true">
      {strikes < minimumStrikes ? tr("{p0} / {p1} \u6B21", { p0: strikes, p1: minimumStrikes }) : tr("\u5DF2\u6572 {p0} \u6B21", { p0: strikes })}
    </div>
    {canFinish && <button type="button" className="scene-bow-tap scene-continuous-finish scene-woodfish-finish" disabled={!active || status !== "ready"} onClick={() => { if (active && status === "ready" && canFinish)
            onFinish?.(); }}>{tr("\u7ED3\u675F\u4EEA\u5F0F")}</button>}
    <button type="button" className="scene-bow-tap" aria-label={tr("\u8F85\u52A9\u8F7B\u6572")} disabled={disabled || !active || status !== "ready"} onClick={strike}>{tr("\u8F85\u52A9")}</button>
    </div>
    </div>
    {status === "failed" && <SceneLoadFailure message={error} onRetry={() => setAttempt(n => n + 1)}/>}
    </>);
}
