import * as THREE from 'three';

const clocks = new WeakMap<THREE.Material, { value: number }>();
/** Three.js adapter for the frozen Komorebi tree-wind.ts deformation. */
export function applyKomorebiTreeWind(material: THREE.Material, time: { value: number }) {
  if (clocks.has(material)) return;
  clocks.set(material, time);
  const before = material.onBeforeCompile, key = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    before.call(material, shader, renderer); shader.uniforms.kmWindTime = time;
    shader.vertexShader = /* glsl */ `
      attribute vec4 _tree_wind;
      uniform float kmWindTime;
      float kmPhase() { return dot(instanceMatrix[3].xz, vec2(.73,.41)); }
      vec2 kmWave() {
        float phase=kmPhase();
        return vec2(sin(kmWindTime*.85+phase)*.041+sin(kmWindTime*1.63+phase*.7)*.014,
          sin(kmWindTime*.79+phase+1.1)*.026+sin(kmWindTime*1.47+phase)*.008);
      }
      float kmFlutter() { return sin(kmWindTime*3.4+kmPhase()+dot(_tree_wind.xyz,vec3(7.1,2.3,5.3)))*.085*_tree_wind.w; }
      vec3 kmRotate(vec3 v) {
        vec3 axis=vec3(.6,0.0,-.8); float angle=kmFlutter();
        return v+cross(axis,v)*sin(angle)+cross(axis,cross(axis,v))*(1.0-cos(angle));
      }
    ` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', /* glsl */ `
      #include <begin_vertex>
      float kmHeight=clamp((position.y-1.5)/1.7,0.0,1.0);
      transformed=_tree_wind.xyz+kmRotate(transformed-_tree_wind.xyz);
      transformed.xz+=kmWave()*kmHeight*kmHeight;
    `).replace('#include <beginnormal_vertex>', /* glsl */ `
      #include <beginnormal_vertex>
      objectNormal=kmRotate(objectNormal);
      float kmDerivative=position.y>1.5 && position.y<3.2 ? 2.0*clamp((position.y-1.5)/1.7,0.0,1.0)/1.7 : 0.0;
      objectNormal.y-=dot(objectNormal.xz,kmWave())*kmDerivative;
      objectNormal=normalize(objectNormal);
    `);
  };
  material.customProgramCacheKey = () => `${key}|komorebi-tree-wind-v1`;
  material.needsUpdate = true;
}

export function copyKomorebiTreeWind(source: THREE.Material, target: THREE.Material) {
  const time = clocks.get(source); if (time) applyKomorebiTreeWind(target, time);
}
