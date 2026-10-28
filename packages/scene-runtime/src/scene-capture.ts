import type * as THREE from "three";

type SceneCapture = () => string | undefined;
const captures = new WeakMap<HTMLCanvasElement, SceneCapture>();
const isPng = (value: string | undefined): value is string =>
  typeof value === "string" && value.startsWith("data:image/png;base64,") && value.length > 22;

/** A renderer owns its capture for exactly as long as it owns its canvas. */
export function registerSceneCapture(canvas: HTMLCanvasElement, capture: SceneCapture) {
  captures.set(canvas, capture);
  return () => { if (captures.get(canvas) === capture) captures.delete(canvas); };
}

/** Synchronous render/readback avoids retaining every WebGL drawing buffer. */
export function captureSceneImage(root: Element): string | undefined {
  const canvases = root.matches("canvas") ? [root as HTMLCanvasElement]
    : Array.from(root.querySelectorAll<HTMLCanvasElement>("canvas"));
  for (const canvas of canvases) {
    if (!canvas.width || !canvas.height) continue;
    try {
      const image = captures.get(canvas)?.();
      if (isPng(image)) return image;
    } catch { /* GPU loss or an unreadable texture is a recoverable export error. */ }
  }
  return undefined;
}

/** Private user text can also be a mesh texture, rather than a DOM overlay. */
export function captureSceneFrame(canvas: HTMLCanvasElement, scene: THREE.Scene, render: () => void): string | undefined {
  if (!canvas.width || !canvas.height) return undefined;
  const hidden: THREE.Object3D[] = [];
  let image: string | undefined;
  try {
    scene.traverse(object => {
      if (object.userData.privateShare === true && object.visible) {
        hidden.push(object); object.visible = false;
      }
    });
    render();
    const encoded = canvas.toDataURL("image/png");
    if (isPng(encoded)) image = encoded;
  } catch { image = undefined; }
  finally {
    hidden.forEach(object => { object.visible = true; });
    // Restore the user's on-screen writing in the same task, before paint.
    if (hidden.length) {
      try { render(); } catch { image = undefined; }
    }
  }
  return image;
}
