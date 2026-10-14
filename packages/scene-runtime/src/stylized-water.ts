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
// Curved focusing bands from three crossing waves, painted on the bed. This is
// an artistic approximation, not a simulated refracted-light projection pass.
float wbrCaustic(vec2 p) {
  p *= wbrCausticScale * 1.65;
  p += 0.66 * sin(p.yx * 0.72 + vec2(wbrWaterTime * 0.18, -wbrWaterTime * 0.15));
  float a = sin(dot(p, vec2(1.1, 0.6)) + wbrWaterTime * 0.26);
  float b = sin(dot(p, vec2(-0.7, 1.2)) - wbrWaterTime * 0.21);
  float c = sin(dot(p, vec2(0.7, -1.4)) + wbrWaterTime * 0.17);
  float xx = 1.65 * (0.63 * a + 0.21 * b + 0.12 * c);
  float zz = 1.65 * (0.19 * a + 0.62 * b + 0.49 * c);
  float xz = 1.65 * (0.34 * a - 0.36 * b - 0.25 * c);
  float focus = abs((1.0 - xx) * (1.0 - zz) - xz * xz);
  float filament = 1.0 - smoothstep(0.018, 0.16, focus);
  float halo = 1.0 - smoothstep(0.08, 0.44, focus);
  return filament * 0.6 + halo * 0.4;
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
    clearcoat: 0.65,
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
    target.customProgramCacheKey = () => bed ? 'wbr-shallow-water-bed-v1' : 'wbr-shallow-water-v1'
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
          diffuseColor.rgb *= 0.94 + sand * 0.045;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.80, 0.87, 0.61), waterCaustic * 0.55);
        `).replace('#include <emissivemap_fragment>', `
          #include <emissivemap_fragment>
          totalEmissiveRadiance += vec3(0.38, 0.48, 0.24) * waterCaustic * 0.22;
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
