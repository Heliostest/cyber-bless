import * as THREE from 'three'

/** One GPU-only copy of the finished world, shared by all labels in a scene. */
export function createCueBackdrop() {
  const resolution = new THREE.Vector2(1, 1)
  const uniforms = { cueBackdrop: { value: null as THREE.FramebufferTexture | null },
    cueResolution: { value: resolution }, cuePixelRatio: { value: 1 }, cueGlassReady: { value: 0 }, cueBackdropSrgb: { value: 1 } }
  let disposed = false
  return {
    uniforms,
    capture(renderer: THREE.WebGLRenderer) {
      if (disposed) return
      renderer.getDrawingBufferSize(resolution)
      if (resolution.x < 1 || resolution.y < 1) return
      let texture = uniforms.cueBackdrop.value
      if (!texture || texture.image.width !== resolution.x || texture.image.height !== resolution.y) {
        texture?.dispose()
        texture = new THREE.FramebufferTexture(resolution.x, resolution.y)
        texture.minFilter = texture.magFilter = THREE.LinearFilter
        // Default RGBA8 framebuffers cannot copy into SRGB8_ALPHA8 on WebGL.
        // Keep compatible raw storage and decode each sample in the shader.
        uniforms.cueBackdrop.value = texture
      }
      uniforms.cuePixelRatio.value = renderer.getPixelRatio()
      uniforms.cueBackdropSrgb.value = renderer.outputColorSpace === THREE.LinearSRGBColorSpace ? 0 : 1
      // r170 can skip activating unit 0 when this texture is already cached
      // there. copyTexSubImage2D must not write into the last text-map unit.
      renderer.state.activeTexture(renderer.getContext().TEXTURE0)
      renderer.copyFramebufferToTexture(texture)
      uniforms.cueGlassReady.value = 1
    },
    dispose() {
      if (disposed) return
      disposed = true; uniforms.cueBackdrop.value?.dispose()
      uniforms.cueBackdrop.value = null; uniforms.cueGlassReady.value = 0
    },
  }
}
export type CueBackdrop = ReturnType<typeof createCueBackdrop>

/** Keep Sprite's typography/opacity while replacing only its glass backing. */
export function applyCueGlass(material: THREE.SpriteMaterial, backdrop: CueBackdrop, size: THREE.Vector2) {
  material.customProgramCacheKey = () => 'scene-cue-frosted-glass-v2'
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, backdrop.uniforms, { cueSize: { value: size } })
    shader.fragmentShader = /* glsl */`
uniform sampler2D cueBackdrop;
uniform vec2 cueResolution;
uniform float cuePixelRatio;
uniform float cueGlassReady;
uniform float cueBackdropSrgb;
uniform vec2 cueSize;
vec3 cueRead(vec2 uv) {
  vec4 color = texture2D(cueBackdrop, uv);
  return mix(color.rgb, sRGBTransferEOTF(color).rgb, cueBackdropSrgb);
}
vec3 cueFrost(vec2 uv) {
  vec2 d = vec2(3.0 * cuePixelRatio) / cueResolution;
  vec3 color = cueRead(uv) * .16;
  color += cueRead(uv + d * vec2(1., 0.)) * .10;
  color += cueRead(uv + d * vec2(-1., 0.)) * .10;
  color += cueRead(uv + d * vec2(0., 1.)) * .10;
  color += cueRead(uv + d * vec2(0., -1.)) * .10;
  color += cueRead(uv + d * vec2(.75, .75)) * .07;
  color += cueRead(uv + d * vec2(-.75, .75)) * .07;
  color += cueRead(uv + d * vec2(.75, -.75)) * .07;
  color += cueRead(uv + d * vec2(-.75, -.75)) * .07;
  color += cueRead(uv + d * vec2(1.8, .4)) * .04;
  color += cueRead(uv + d * vec2(-1.8, -.4)) * .04;
  color += cueRead(uv + d * vec2(.4, -1.8)) * .04;
  color += cueRead(uv + d * vec2(-.4, 1.8)) * .04;
  return mix(vec3(dot(color, vec3(.2126, .7152, .0722))), color, .88);
}
` + shader.fragmentShader.replace('#include <map_fragment>', /* glsl */`
#include <map_fragment>
#ifdef USE_MAP
  if (cueGlassReady > .5) {
    float radius = min(14., (cueSize.y - 8.) * .5);
    vec2 corner = abs((vMapUv - .5) * cueSize) - (cueSize * .5 - 4. - radius);
    float distanceToEdge = length(max(corner, 0.)) + min(max(corner.x, corner.y), 0.) - radius;
    float glassMask = 1. - smoothstep(-.5, .5, distanceToEdge);
    float inkAlpha = diffuseColor.a / max(opacity, .0001);
    vec3 behind = cueFrost(gl_FragCoord.xy / cueResolution);
    // Judge the entire label from three broad background samples, so glyphs
    // share one contrast treatment while the glass retains the world's color.
    vec2 centerUv = (gl_FragCoord.xy + (.5 - vMapUv) * cueSize * cuePixelRatio) / cueResolution;
    vec2 span = vec2(cueSize.x * .22 * cuePixelRatio / cueResolution.x, 0.);
    vec3 panelColor = (cueRead(centerUv) + cueRead(centerUv - span) + cueRead(centerUv + span)) / 3.;
    float night = 1. - step(.18, dot(panelColor, vec3(.2126, .7152, .0722)));
    float pigment = 1. - smoothstep(.12, .4, dot(diffuseColor.rgb, vec3(.2126, .7152, .0722)));
    float lettering = pigment * smoothstep(.18, .65, inkAlpha);
    // Dark scenes use a slight smoke tint and light lettering, rather than
    // increasing a white fill until the panel looks solid again.
    float surface = (1. - lettering) * (1. - smoothstep(.22, .65, inkAlpha));
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.012, .026, .023), night * surface);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.88, .96, .93), night * lettering);
    diffuseColor.rgb = mix(behind, diffuseColor.rgb, inkAlpha);
    diffuseColor.a = max(diffuseColor.a, glassMask * opacity * .9);
  }
#endif
`)
  }
}
