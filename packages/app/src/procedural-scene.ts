import * as Gestures from "@wbr/gestures";
import * as Shared from "@wbr/shared";
import { loadScene, localizeSceneOverlay, type SceneContext } from "@wbr/scenes";
import type { SceneController, SceneEngine } from "@wbr/scene-runtime";
export type ProceduralContext = {
  progress: number;
  checkpoint(progress: number): void;
  sceneId: string;
  /** App feedback, read live so 音效/震动 toggles apply mid-scene. */
  prepareFeedback?(): void;
  haptic?: SceneContext["haptic"];
  isSoundEnabled?(): boolean;
  /** Keeps a line from the scene's wish box as a new 心愿. */
  saveWish?(text: string): void;
  /** The App offers its optional wish record after the scene is complete. */
  deferWishWriting?: boolean;
  returning?: boolean;
  initialVariant?: string;
  onVariantChange?(variant: string): void;
  /** The stage the App paints behind the canvas, so the scene lights for it. */
  stage?: "day" | "night";
};

/** Adapts two independent interaction implementations to the shared lifecycle. */
export async function proceduralEngine(
  id: string,
): Promise<SceneEngine<ProceduralContext, SceneController>> {
  const module = await loadScene(id);
  return {
    create(host, context, options) {
      const canvas = document.createElement("canvas"),
        overlay = document.createElement("div");
      canvas.className = "scene-canvas";
      overlay.className = "scene-overlay-host";
      host.replaceChildren(canvas, overlay);
      let active = options.active,
        reduced = options.reducedMotion,
        disposed = false,
        frame = 0;
      const instance = module.create({
        canvas,
        overlay,
        gestures: context.deferWishWriting ? {
          ...Gestures,
          createWishWrite: () => ({
            mount(target) { target.hidden = true; },
            update() {},
            setEnabled() {},
            dispose() {},
          }),
        } : Gestures,
        shared: Shared,
        initialProgress: context.progress,
        onProgress: context.checkpoint,
        sceneId: context.sceneId,
        isActive: () => active && !disposed,
        isReducedMotion: () => reduced,
        prepareFeedback: context.prepareFeedback,
        haptic: context.haptic,
        isSoundEnabled: context.isSoundEnabled,
        saveWish: context.saveWish,
        deferWishWriting: context.deferWishWriting,
        returning: context.returning,
        initialVariant: context.initialVariant,
        onVariantChange: context.onVariantChange,
        stage: context.stage,
      });
      const stopLocale = localizeSceneOverlay(overlay);
      const dispose = () => {
        if (disposed) return;
        disposed = true;
        cancelAnimationFrame(frame);
        canvas.removeEventListener("webglcontextlost", lost);
        stopLocale();
        instance.dispose();
        host.replaceChildren();
      };
      const lost = (event: Event) => {
        event.preventDefault();
        options.failed(Error("Graphics context lost"));
      };
      canvas.addEventListener("webglcontextlost", lost);
      let last = performance.now();
      function tick(now: number) {
        frame = 0;
        if (disposed || !active) return;
        try {
          instance.update(Math.min((now - last) / 1000, 0.05));
          last = now;
        } catch (error) {
          options.failed(error);
          return;
        }
        frame = requestAnimationFrame(tick);
      }
      function setActive(value: boolean) {
        if (disposed) return;
        const wasActive = active;
        active = value;
        overlay.inert = !value;
        cancelAnimationFrame(frame);
        frame = 0;
        // RAF stops while inactive; give the scene one zero-time update so
        // its pending pointer ownership is cleared before a later resume.
        if (wasActive && !value) {
          try { instance.update(0); }
          catch (error) { options.failed(error); }
        }
        if (value && !disposed) {
          last = performance.now();
          frame = requestAnimationFrame(tick);
        }
      }
      try {
        instance.start();
        instance.update(0);
        setActive(active);
        options.ready();
      } catch (error) {
        dispose();
        throw error;
      }
      return {
        dispose,
        setActive,
        tapPreview() {
          if (disposed || !active || !host.closest('[data-scene-presentation="object"]')) return false;
          return instance.tapPreview?.() ?? false;
        },
        setReducedMotion(value) {
          reduced = value;
        },
      };
    },
  };
}
