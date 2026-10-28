import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { sceneStepCount } from "@wbr/core";
import type { CatalogEntry } from "@wbr/content/catalog";
import { mountScene, type SceneController, type SceneEngine, type SceneSession } from "@wbr/scene-runtime";
import { Icon } from "./art";
import { useApp } from "./context";
import type { ProceduralContext } from "./procedural-scene";
import { sceneEngines, type WoodfishContext } from "./scene-engines";
import { useContent, woodfishContent } from "./content";
import { previewContent } from "./daily-scene-preview";
import { hasSceneIcon, SceneIcon } from "./scene-icons";
import { sceneStage } from "./scene-placement";

export type WishObjectPreviewHandle = { tap(): boolean };
type PreviewProps = { entry: CatalogEntry; variant?: string; ref?: Ref<WishObjectPreviewHandle> };
type PreviewStatus = "loading" | "ready" | "failed";
type EngineId = Parameters<typeof sceneEngines.load>[0];
type PreviewContext = ProceduralContext | WoodfishContext;

/** A completed object, with no scene input, progress, wishes or feedback. */
export function WishObjectPreview({ entry, variant, ref }: PreviewProps) {
  return <ObjectPreview key={JSON.stringify([entry.id, entry.engine, variant])} entry={entry} variant={variant} ref={ref} />;
}

function ObjectPreview({ entry, variant, ref }: PreviewProps) {
  const { active, state } = useApp();
  const environment = useContent();
  const frame = useRef<HTMLSpanElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const session = useRef<SceneSession<SceneController> | null>(null);
  const reducedMotion = state.settings.reducedMotion;
  const motion = useRef(reducedMotion);
  motion.current = reducedMotion;
  const [onScreen, setOnScreen] = useState(() => typeof IntersectionObserver !== "function");
  const [status, setStatus] = useState<PreviewStatus>(() =>
    typeof WebGL2RenderingContext === "undefined" ? "failed" : "loading");
  const failed = status === "failed";
  const stage = sceneStage(entry.id);
  useImperativeHandle(ref, () => ({ tap() {
    if (!active || !onScreen || status !== "ready") return false;
    return session.current?.controller?.tapPreview?.() ?? false;
  } }), [active, onScreen, status]);

  useEffect(() => {
    if (!frame.current || typeof IntersectionObserver !== "function") return;
    let watching = true;
    const observer = new IntersectionObserver(entries => {
      if (watching && entries.length) setOnScreen(entries[entries.length - 1].isIntersecting);
    });
    observer.observe(frame.current);
    return () => { watching = false; observer.disconnect(); };
  }, []);

  useEffect(() => {
    if (!active || !onScreen || failed || !host.current) return;
    let instance: SceneSession<SceneController> | undefined;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      instance?.dispose();
      if (session.current === instance) session.current = null;
    };
    const context: PreviewContext = entry.engine === "woodfish@1" ? {
      sceneId: entry.id,
      content: previewContent(woodfishContent(environment)),
      decodeSound: () => Promise.reject(Error("A preview has no sound")),
      onInstruction: () => {},
      impact: () => {},
    } : {
      progress: sceneStepCount(entry),
      checkpoint: () => {},
      sceneId: entry.id,
      stage,
      deferWishWriting: true,
      initialVariant: variant,
      isSoundEnabled: () => false,
    };
    setStatus("loading");
    instance = mountScene<PreviewContext, SceneController>({
      host: host.current,
      context,
      active: true,
      reducedMotion: motion.current,
      load: () => sceneEngines.load(entry.engine as EngineId) as Promise<SceneEngine<PreviewContext, SceneController>>,
      ready: () => { if (!released) setStatus("ready"); },
      failed: () => {
        if (released) return;
        release();
        setStatus("failed");
      },
    });
    // A synchronous engine failure may happen before mountScene returns.
    if (released) instance.dispose();
    else session.current = instance;
    return release;
  }, [active, onScreen, failed, entry.id, entry.engine, stage, variant]);

  useEffect(() => session.current?.setReducedMotion(reducedMotion), [reducedMotion]);

  return <span className="wish-object-preview" data-status={status} ref={frame} inert aria-hidden="true">
    {failed
      ? hasSceneIcon(entry.id) ? <SceneIcon id={entry.id} /> : <Icon name="leaf" />
      : <div className="library-scene-stage wish-object-preview-stage" data-scene={entry.id} data-stage={stage} data-scene-presentation="object" ref={host} />}
  </span>;
}
