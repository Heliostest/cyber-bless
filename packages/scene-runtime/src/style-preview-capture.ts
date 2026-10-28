import * as THREE from "three";
import type { RenderStyleId } from "@wbr/content";
import type { RenderStyleParameters } from "./render-style-parameters";
import { createRenderStyle } from "./render-style";

export type StylePreviewCapture = (style: RenderStyleId, parameters: RenderStyleParameters) => string | null;

export function createStylePreviewCapture(
  renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera,
  main: { getStyle(): RenderStyleId; render(): void }, prepare: (style: RenderStyleId) => void = () => {},
): StylePreviewCapture {
  return (id, parameters) => {
    const source = renderer.domElement;
    if (!source.width || !source.height) return null;
    const previous = {
      target: renderer.getRenderTarget(), face: renderer.getActiveCubeFace(), level: renderer.getActiveMipmapLevel(),
      viewport: renderer.getViewport(new THREE.Vector4()), scissor: renderer.getScissor(new THREE.Vector4()),
      scissorTest: renderer.getScissorTest(), autoClear: renderer.autoClear,
      toneMapping: renderer.toneMapping, exposure: renderer.toneMappingExposure, colorSpace: renderer.outputColorSpace,
      clearColor: renderer.getClearColor(new THREE.Color()), clearAlpha: renderer.getClearAlpha(),
      shaderError: renderer.debug.onShaderError, xr: renderer.xr.enabled,
      shadows: { enabled: renderer.shadowMap.enabled, type: renderer.shadowMap.type,
        autoUpdate: renderer.shadowMap.autoUpdate, needsUpdate: renderer.shadowMap.needsUpdate },
    };
    const restore = () => {
      renderer.setRenderTarget(previous.target, previous.face, previous.level);
      renderer.setViewport(previous.viewport); renderer.setScissor(previous.scissor); renderer.setScissorTest(previous.scissorTest);
      renderer.autoClear = previous.autoClear; renderer.toneMapping = previous.toneMapping;
      renderer.toneMappingExposure = previous.exposure; renderer.outputColorSpace = previous.colorSpace;
      renderer.setClearColor(previous.clearColor, previous.clearAlpha);
      renderer.debug.onShaderError = previous.shaderError; renderer.xr.enabled = previous.xr;
      Object.assign(renderer.shadowMap, previous.shadows);
    };
    let temporary: ReturnType<typeof createRenderStyle> | undefined, result: string | null = null, failed = false;
    try {
      renderer.debug.onShaderError = () => { failed = true; };
      renderer.setRenderTarget(null); renderer.setScissorTest(false); renderer.xr.enabled = false;
      prepare(id);
      temporary = createRenderStyle(renderer, scene, camera);
      temporary.setStyle(id); temporary.setParameters(parameters); temporary.render();
      // A fallback frame is real, but it is not a preview of the requested shader.
      if (!failed && temporary.getStyle() === id) {
        const image = document.createElement("canvas");
        image.width = 160; image.height = 120;
        const context = image.getContext("2d");
        if (context) {
          // Fill the photo frame without stretching; only the thumbnail is center-cropped.
          const scale = Math.max(image.width / source.width, image.height / source.height);
          const width = source.width * scale, height = source.height * scale;
          context.drawImage(source, 0, 0, source.width, source.height,
            (image.width - width) / 2, (image.height - height) / 2, width, height);
          const encoded = image.toDataURL("image/webp", .82);
          if (encoded.startsWith("data:image/")) result = encoded;
        }
      }
    } catch {
      failed = true;
    } finally {
      try { temporary?.dispose(); } catch { failed = true; }
      restore();
      try {
        renderer.setRenderTarget(null); renderer.setScissorTest(false);
        prepare(main.getStyle());
        main.render();
      } catch {
        failed = true;
      } finally {
        // Main rendering may also alter renderer state; leave the owner as found.
        restore();
      }
    }
    return failed ? null : result;
  };
}
