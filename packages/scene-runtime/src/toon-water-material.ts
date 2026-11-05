/*!
 * @license Water Toon Torrent — Leon Denise, 2023/08/19.
 * https://www.shadertoy.com/view/dlScDt
 * Ported from Shader Gallery src/three-materials/water-material.js.
 * Changes: opacity, optional local XZ projection, fog; no geometric displacement.
 * The archived source contains no explicit license grant. No additional rights
 * are asserted. See toon-water-ATTRIBUTION.md for the source and access record.
 */
import * as THREE from 'three';

const vertexShader = /* glsl */ `
uniform float uWaveHeight;
varying vec2 vWaterUv;
#include <fog_pars_vertex>
void main() {
  #ifdef WBR_WATER_PROJECTED
    vWaterUv = position.xz;
  #else
    vWaterUv = uv;
  #endif
  // Keep the authored water level and CPU raycast geometry coincident.
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform float uScale;
uniform float uSpeed;
uniform vec3 uColor;
uniform vec3 uDeepColor;
uniform vec3 uFoamColor;
uniform float uBands;
uniform float uOpacity;
varying vec2 vWaterUv;
#include <fog_pars_fragment>
float gyroid(vec3 seed) {
  return dot(sin(seed), cos(seed.yzx));
}
float fbm(vec3 seed) {
  float result = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 6; i++) {
    seed.x += uTime * uSpeed * 0.01 / amplitude;
    seed.z += result * 0.5;
    result += gyroid(seed / amplitude) * amplitude;
    amplitude *= 0.5;
  }
  return result;
}
void main() {
  vec2 p = (vWaterUv - 0.5) * uScale;
  float count = 2.0;
  float shades = max(1.0, uBands);
  float shape = abs(fbm(vec3(p * 0.5, 0.0)))
    - uTime * uSpeed * 0.1 - p.x * 0.1;
  float gradient = fract(shape * count + p.x);
  float foam = floor(pow(gradient, 4.0) * shades + 0.5) / shades;
  vec3 tint = mix(uColor * mix(0.6, 0.8, gradient), uFoamColor, foam);
  vec3 color = mix(tint, uDeepColor, mod(floor(shape * count), 2.0));
  gl_FragColor = vec4(color, uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

export function createToonWaterMaterial(projected = false) {
  return new THREE.ShaderMaterial({
    name: 'Gallery Toon Water',
    defines: projected ? { WBR_WATER_PROJECTED: 1 } : {},
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTime: { value: 0 }, uScale: { value: projected ? 2 : 6 },
      uSpeed: { value: .75 }, uBands: { value: 3 },
      uColor: { value: new THREE.Color(0x75c3ff) },
      uDeepColor: { value: new THREE.Color(0x17364c) },
      uFoamColor: { value: new THREE.Color(0xf0fbff) },
      uOpacity: { value: 1 }, uWaveHeight: { value: 0 },
    },
    vertexShader, fragmentShader, fog: true,
  });
}
