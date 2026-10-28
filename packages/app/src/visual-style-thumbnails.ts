import { useEffect, useRef, useState } from "react";
import { styleParameterControls, visualStyleOptions, type RenderStyleParameters, type VisualStyleId } from "@wbr/core/visual-style";
import { sceneStyles, type DebugScene } from "@wbr/scene-runtime/debug-styles";

type Thumbnail = { version: number; key: string; image: string | null };
const parameterKey = (id: VisualStyleId, parameters: RenderStyleParameters) => styleParameterControls
  .filter(control => control.style === id).map(control => `${control.key}:${parameters[control.key]}`).join("|");

/** A menu-local cache; thumbnails never become saved scene preferences. */
export function useVisualStyleThumbnails(scene: DebugScene, parameters: RenderStyleParameters): Partial<Record<VisualStyleId, string | null>> {
  const cache = useRef(new Map<VisualStyleId, Thumbnail>());
  const [images, setImages] = useState<Partial<Record<VisualStyleId, Thumbnail>>>({});
  const parametersKey = JSON.stringify(parameters);
  useEffect(() => {
    const version = scene.previewVersion, capture = sceneStyles.getPreviewCapture(scene.id, scene.scope);
    if (!version || !capture) return;
    const queue = visualStyleOptions.map(option => option.id).filter(id => {
      const previous = cache.current.get(id);
      return previous?.version !== version || previous.key !== parameterKey(id, parameters);
    });
    if (!queue.length) return;
    let cancelled = false, frame = 0;
    const step = () => {
      if (cancelled) return;
      const id = queue.shift();
      if (!id) return;
      const thumbnail = { version, key: parameterKey(id, parameters), image: capture(id, parameters) };
      if (cancelled) return;
      cache.current.set(id, thumbnail);
      setImages(previous => ({ ...previous, [id]: thumbnail }));
      if (queue.length) frame = requestAnimationFrame(step);
    };
    // Slider changes coalesce; cached shaders with unchanged controls are reused.
    const timer = window.setTimeout(() => { frame = requestAnimationFrame(step); }, cache.current.size ? 180 : 0);
    return () => { cancelled = true; window.clearTimeout(timer); cancelAnimationFrame(frame); };
  }, [scene.id, scene.scope, scene.previewVersion, parametersKey]);

  const current: Partial<Record<VisualStyleId, string | null>> = {};
  for (const option of visualStyleOptions) {
    const image = images[option.id];
    if (image && image.version === scene.previewVersion && image.key === parameterKey(option.id, parameters))
      current[option.id] = image.image;
  }
  return current;
}
