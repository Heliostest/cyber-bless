import { BoundingInfo, MaterialPluginBase, Mesh, Scene, ShadowDepthWrapper, StandardMaterial, Vector3, type UniformBuffer } from '@babylonjs/core';

/** Model-space allowance, reserved by the tree geometry and expanded on its culling box. */
export const TREE_WIND_MARGIN = .09;
export interface TreeWind {
  enabled: boolean;
  paused: boolean;
  time: number;
  dispose(): void;
}

class TreeWindPlugin extends MaterialPluginBase {
  constructor(material: StandardMaterial, private state: TreeWind) {
    super(material, 'KomorebiTreeWind', 170, {}, true, false);
    this.registerForExtraEvents = true;
    this._enable(true);
  }
  getAttributes(attributes: string[]) { attributes.push('treeWind'); }
  getUniforms() {
    return {
      ubo: [{ name: 'kmWindTime', size: 1, type: 'float' }, { name: 'kmWindStrength', size: 1, type: 'float' }],
      vertex: 'uniform float kmWindTime;\nuniform float kmWindStrength;',
    };
  }
  hardBindForSubMesh(buffer: UniformBuffer) {
    buffer.updateFloat('kmWindTime', this.state.time);
    buffer.updateFloat('kmWindStrength', this.state.enabled ? 1 : 0);
    buffer.update();
  }
  bindForSubMesh(buffer: UniformBuffer) { this.hardBindForSubMesh(buffer); }
  getCustomCode(shaderType: string) {
    if (shaderType !== 'vertex') return null;
    return {
      CUSTOM_VERTEX_DEFINITIONS: 'attribute vec4 treeWind;',
      CUSTOM_VERTEX_UPDATE_WORLDPOS: `
        float kmScale = length(finalWorld[1].xyz);
        float kmPhase = dot(finalWorld[3].xz, vec2(0.73, 0.41));
        float kmHeight = clamp((positionUpdated.y - 1.5) / 1.7, 0.0, 1.0);
        vec2 kmWave = vec2(
          sin(kmWindTime * 0.85 + kmPhase) * 0.041 + sin(kmWindTime * 1.63 + kmPhase * 0.7) * 0.014,
          sin(kmWindTime * 0.79 + kmPhase + 1.1) * 0.026 + sin(kmWindTime * 1.47 + kmPhase) * 0.008
        ) * kmWindStrength;
        vec3 kmAxis = vec3(0.6, 0.0, -0.8);
        float kmFlutter = sin(kmWindTime * 3.4 + kmPhase + dot(treeWind.xyz, vec3(7.1, 2.3, 5.3)))
          * 0.085 * treeWind.w * kmWindStrength;
        vec3 kmPivot = (finalWorld * vec4(treeWind.xyz, 1.0)).xyz;
        vec3 kmRelative = worldPos.xyz - kmPivot;
        worldPos.xyz += cross(kmAxis, kmRelative) * sin(kmFlutter)
          + cross(kmAxis, cross(kmAxis, kmRelative)) * (1.0 - cos(kmFlutter));
        worldPos.xz += kmWave * (kmHeight * kmHeight) * kmScale;
        #ifdef NORMAL
          vNormalW += cross(kmAxis, vNormalW) * sin(kmFlutter)
            + cross(kmAxis, cross(kmAxis, vNormalW)) * (1.0 - cos(kmFlutter));
          float kmDerivative = positionUpdated.y > 1.5 && positionUpdated.y < 3.2 ? 2.0 * kmHeight / 1.7 : 0.0;
          vNormalW.y -= dot(vNormalW.xz, kmWave) * kmDerivative;
          vNormalW = normalize(vNormalW);
        #endif
      `,
    };
  }
}

/** One clock and one GPU deformation serve every instance and both color/depth passes. */
export function createTreeWind(scene: Scene, materials: StandardMaterial[]): TreeWind {
  let disposed = false;
  const wrappers: { material: StandardMaterial; wrapper: ShadowDepthWrapper }[] = [];
  const state: TreeWind = {
    enabled: true, paused: false, time: 0,
    dispose() {
      if (disposed) return;
      disposed = true; state.enabled = false;
      scene.onBeforeRenderObservable.remove(clock);
      for (const { material, wrapper } of wrappers) {
        wrapper.dispose();
        if (material.shadowDepthWrapper === wrapper) material.shadowDepthWrapper = null;
      }
      wrappers.length = 0;
    },
  };
  const clock = scene.onBeforeRenderObservable.add(() => {
    if (!state.paused && state.enabled) state.time += Math.max(0, Math.min(50, scene.getEngine().getDeltaTime())) / 1000;
  });
  for (const material of materials) {
    new TreeWindPlugin(material, state);
    const wrapper = new ShadowDepthWrapper(material, scene, { standalone: true });
    material.shadowDepthWrapper = wrapper;
    wrappers.push({ material, wrapper });
  }
  return state;
}

export function prepareTreeWindMesh(mesh: Mesh, data: { wind: number[] }): void {
  mesh.setVerticesData('treeWind', data.wind, false, 4);
  const box = mesh.getBoundingInfo().boundingBox, margin = new Vector3(TREE_WIND_MARGIN, .025, TREE_WIND_MARGIN);
  mesh.setBoundingInfo(new BoundingInfo(box.minimum.subtract(margin), box.maximum.add(margin)));
}
