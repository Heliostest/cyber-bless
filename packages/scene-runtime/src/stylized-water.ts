import * as THREE from 'three'

export type StylizedWaterOptions<G extends THREE.BufferGeometry> = {
  /** Owned by this effect; the authored surface remains the interaction geometry. */
  geometry: G
  /** CircleGeometry faces +Z; a horizontal, already-rotated plane faces +Y. */
  normal?: 'z' | 'y'
  depth?: number
  color?: THREE.ColorRepresentation
  bedColor?: THREE.ColorRepresentation
  opacity?: number
  waveScale?: number
  causticScale?: number
  /** A sparse, narrow shoreline highlight for a circular pool. */
  radius?: number
}

const WORLD_VERTEX = `
varying vec3 wbrWaterWorld;
varying vec3 wbrWaterLocal;
`
const WORLD_FRAGMENT = `
varying vec3 wbrWaterWorld;
varying vec3 wbrWaterLocal;
uniform float wbrWaterTime;
uniform float wbrWaveScale;
uniform float wbrCausticScale;
uniform float wbrWaterRadius;

// Two long crossing wave trains, with a quieter short ripple on top.
vec2 wbrWaterSlope(vec2 p) {
  p *= wbrWaveScale;
  float a = dot(p, vec2(2.7, 1.1)) + wbrWaterTime * 0.65;
  float b = dot(p, vec2(-1.5, 3.2)) - wbrWaterTime * 0.48;
  float c = dot(p, vec2(6.4, 4.8)) + wbrWaterTime * 0.82;
  return vec2(2.7, 1.1) * cos(a) * 0.022
    + vec2(-1.5, 3.2) * cos(b) * 0.014
    + vec2(6.4, 4.8) * cos(c) * 0.003;
}
`

const CAUSTIC_FRAGMENT = `
// Two warped cellular fields make the light network breathe, rather than slide
// a rigid polygon grid across the bed. This remains an artistic approximation.
vec2 wbrCellRandom(vec2 cell) {
  return fract(sin(vec2(dot(cell, vec2(123.4, 253.7)),
    dot(cell, vec2(371.9, 147.3)))) * 43713.73);
}
float wbrCellEdge(vec2 p, float phase) {
  vec2 cell = floor(p), local = fract(p);
  float nearest = 8.0, second = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(y));
      vec2 seed = wbrCellRandom(cell + offset);
      vec2 site = 0.5 + 0.34 * sin(seed * 6.283185 + phase * (0.7 + seed.yx * 0.3));
      vec2 delta = offset + site - local;
      float d = dot(delta, delta);
      second = min(second, max(nearest, d));
      nearest = min(nearest, d);
    }
  }
  return sqrt(second) - sqrt(nearest);
}
float wbrLightFilament(float edge, float width) {
  float aa = max(fwidth(edge), 0.001);
  float core = 1.0 - smoothstep(max(0.0, width - aa), width + aa, edge);
  float halo = exp(-edge * edge / (width * width * 16.0));
  return core * 0.72 + halo * 0.28;
}
float wbrCaustic(vec2 world) {
  vec2 p = world * wbrCausticScale * 0.70;
  float t = wbrWaterTime * 0.32;
  vec2 warp = vec2(sin(p.y * 1.13 + p.x * 0.37 + t),
    sin(p.x * 1.27 - p.y * 0.29 - t * 0.83));
  p += warp * 0.72;
  p += 0.24 * vec2(sin(p.y * 2.41 - t * 0.71), sin(p.x * 2.17 + t * 0.62));
  float edgeA = wbrCellEdge(p + vec2(t * 0.15, -t * 0.11), t);
  vec2 crossed = mat2(0.8, -0.6, 0.6, 0.8) * p * 1.29 + vec2(7.2, 13.4);
  float edgeB = wbrCellEdge(crossed + vec2(-t * 0.12, t * 0.09), -t * 0.79);
  float focus = 0.5 + 0.5 * sin(p.x * 0.83 + p.y * 1.17 + sin(p.y * 0.71 - t) + t);
  float first = wbrLightFilament(edgeA, mix(0.015, 0.035, focus));
  float second = wbrLightFilament(edgeB, 0.018);
  float light = first * mix(0.08, 1.05, focus * focus)
    + second * (0.04 + smoothstep(0.6, 0.95, focus) * 0.13);
  // Fade subpixel cells toward the horizon instead of making a busy white mesh.
  float footprint = max(length(dFdx(p)), length(dFdy(p)));
  float distanceFade = 1.0 - smoothstep(9.0, 24.0, length(cameraPosition - wbrWaterWorld));
  return light * distanceFade * (1.0 - smoothstep(0.12, 0.42, footprint));
}
`

/**
 * A local WebGL water surface and its shallow sandy receiver. Uses the existing
 * Three lighting/fog pipeline; no textures, render targets or independent RAF.
 * Normals animate without displacing the authored raycast surface. Put the
 * surrounding ground below the bed, or cut a hole in it for a contained pool.
 */
export function createStylizedWater<G extends THREE.BufferGeometry>(options: StylizedWaterOptions<G>) {
  const depth = options.depth ?? 0.22
  const clock = { value: 0 }
  const uniforms = {
    wbrWaterTime: clock,
    wbrWaveScale: { value: options.waveScale ?? 1 },
    wbrCausticScale: { value: options.causticScale ?? 3.6 },
    wbrWaterRadius: { value: options.radius ?? 0 },
  }
  const material = new THREE.MeshPhysicalMaterial({
    color: options.color ?? 0x67c5c2,
    roughness: 0.23,
    metalness: 0,
    ior: 1.333,
    clearcoat: 0.42,
    clearcoatRoughness: 0.19,
    transparent: true,
    opacity: options.opacity ?? 0.48,
    depthWrite: false,
  })
  const bedMaterial = new THREE.MeshStandardMaterial({
    color: options.bedColor ?? 0xa9b28b,
    roughness: 0.93,
    // Keep the shader when the shared toon pass adapts opaque materials.
    transparent: true,
    opacity: 1,
    depthWrite: true,
  })

  for (const [target, bed] of [[material, false], [bedMaterial, true]] as const) {
    target.customProgramCacheKey = () => bed ? 'wbr-voronoi-water-bed-v2' : 'wbr-shallow-water-v1'
    target.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, uniforms)
      shader.vertexShader = WORLD_VERTEX + shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        wbrWaterLocal = position;
        wbrWaterWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
      `)
      shader.fragmentShader = WORLD_FRAGMENT + (bed ? CAUSTIC_FRAGMENT : '') + shader.fragmentShader
      if (bed) {
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
          #include <color_fragment>
          float waterCaustic = wbrCaustic(wbrWaterWorld.xz);
          float sand = sin(wbrWaterWorld.x * 19.0 + sin(wbrWaterWorld.z * 13.0))
            * sin(wbrWaterWorld.z * 17.0 + sin(wbrWaterWorld.x * 9.0));
          diffuseColor.rgb *= vec3(0.68, 0.87, 0.84) * (0.94 + sand * 0.045);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.95, 0.76), waterCaustic * 0.48);
        `).replace('#include <emissivemap_fragment>', `
          #include <emissivemap_fragment>
          totalEmissiveRadiance += vec3(0.38, 0.48, 0.32) * waterCaustic * 0.12;
        `)
      } else {
        shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
          #include <normal_fragment_maps>
          vec2 waterSlope = wbrWaterSlope(wbrWaterWorld.xz);
          normal = normalize((viewMatrix * vec4(normalize(vec3(-waterSlope.x, 1.0, -waterSlope.y)), 0.0)).xyz);
        `).replace('#include <clearcoat_normal_fragment_maps>', `
          #include <clearcoat_normal_fragment_maps>
          #ifdef USE_CLEARCOAT
            clearcoatNormal = normal;
          #endif
        `).replace('#include <color_fragment>', `
          #include <color_fragment>
          float broadWave = sin(dot(wbrWaterWorld.xz, vec2(2.7, 1.1)) * wbrWaveScale + wbrWaterTime * 0.65);
          diffuseColor.rgb *= 0.94 + broadWave * 0.06;
          float shore = 0.0;
          if (wbrWaterRadius > 0.0) {
            float edge = length(wbrWaterLocal.xy) / wbrWaterRadius;
            float broken = smoothstep(0.2, 0.7, sin(atan(wbrWaterLocal.y, wbrWaterLocal.x) * 9.0 + wbrWaterTime * 0.12));
            shore = smoothstep(0.968, 0.99, edge) * broken * 0.34;
          }
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.76, 0.94, 0.81), shore);
          diffuseColor.a += shore * 0.25;
        `)
      }
    }
  }

  const surface = new THREE.Mesh(options.geometry, material)
  surface.name = 'stylized-water-surface'
  surface.receiveShadow = true
  surface.renderOrder = 1
  surface.userData.toonSurface = { outline: false }
  const bedGeometry = options.geometry.clone()
  const bed = new THREE.Mesh(bedGeometry, bedMaterial)
  bed.name = 'stylized-water-caustic-bed'
  bed.position[options.normal === 'y' ? 'y' : 'z'] = -depth
  bed.receiveShadow = true
  bed.renderOrder = -1
  bed.userData.toonSurface = { outline: false }
  bed.raycast = () => {} // Decoration never adds a gesture target.
  surface.add(bed)
  let disposed = false
  return {
    surface,
    bed,
    /** Seconds of animated time; reduced motion and inactive scenes hold this phase. */
    get time() { return clock.value },
    update(dt: number, reducedMotion = false) {
      if (disposed || reducedMotion || !Number.isFinite(dt) || dt <= 0) return
      clock.value += Math.min(dt, 0.1)
    },
    dispose() {
      if (disposed) return
      disposed = true
      surface.removeFromParent()
      surface.remove(bed)
      options.geometry.dispose()
      bedGeometry.dispose()
      material.dispose()
      bedMaterial.dispose()
    },
  }
}
