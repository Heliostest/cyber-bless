import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import * as THREE from 'three'

/**
 * Watertight plump drop-shaped wheat kernel centered in `[-1, 1]` along Y,
 * with a subtle ventral belly crease on the inner (`-X`) flank and warm
 * toasted-base to sunlit-gold vertex tonal layering.
 *
 * Uses exact shared pole and ring indices (no duplicated seam column) so
 * every undirected edge is shared by exactly 2 outward-facing triangles.
 */
export function createWheatKernelGeometry(): THREE.BufferGeometry {
  const rings = 9
  const sides = 12
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []

  const tmpColor = new THREE.Color()
  const pushColor = (t: number, crease: number, dorsal: number) => {
    // Author in perceptual sRGB and convert to linear for BufferAttribute('color'):
    // toasted wheat-amber base (#c5862e) -> plump honey-gold belly (#e8b84e) -> sunlit tip (#f4d274).
    const s = Math.pow(t, 0.82)
    let sr = THREE.MathUtils.lerp(0.77, 0.96, s) + dorsal * 0.025 - crease * 0.16
    let sg = THREE.MathUtils.lerp(0.53, 0.82, s) + dorsal * 0.020 - crease * 0.17
    let sb = THREE.MathUtils.lerp(0.18, 0.44, Math.pow(t, 0.96)) + dorsal * 0.010 - crease * 0.09
    sr = THREE.MathUtils.clamp(sr, 0.44, 0.97)
    sg = THREE.MathUtils.clamp(sg, 0.30, 0.85)
    sb = THREE.MathUtils.clamp(sb, 0.10, 0.48)
    tmpColor.setRGB(sr, sg, sb, THREE.SRGBColorSpace)
    colors.push(tmpColor.r, tmpColor.g, tmpColor.b)
  }

  // Bottom pole (glume attachment base, y = -1).
  positions.push(0, -1, 0)
  pushColor(0, 0.18, 0)

  for (let ring = 1; ring < rings; ring++) {
    const t = ring / rings
    // Slightly fuller lower belly, graceful pointed-drop upper shoulder.
    const y = -Math.cos(t * Math.PI)
    const sinT = Math.sin(t * Math.PI)
    const drop = Math.pow(sinT, 0.78) * (1.06 - 0.18 * t + 0.08 * Math.sin(t * Math.PI * 2))
    const rx = Math.min(1.0, drop * 0.96)
    const rz = Math.min(0.90, drop * 0.87)
    const creaseEnv = Math.pow(sinT, 1.15)

    for (let side = 0; side < sides; side++) {
      const angle = (side * Math.PI * 2) / sides
      const cosA = Math.cos(angle)
      const sinA = Math.sin(angle)

      // Faint wheat belly groove angled slightly off -X so it catches soft shadow from 3/4 views.
      const grooveDelta = Math.atan2(Math.sin(angle - Math.PI * 0.82), Math.cos(angle - Math.PI * 0.82))
      const groove = Math.exp(-(grooveDelta * grooveDelta) / 0.24) * creaseEnv
      // Gentle plump dorsal cheek opposite the groove.
      const dorsal = Math.max(0, cosA) * sinT
      const radiusScale = 1 - 0.23 * groove + 0.04 * dorsal

      positions.push(cosA * rx * radiusScale, y, sinA * rz * radiusScale)
      pushColor(t, groove, dorsal)
    }
  }

  // Top pole (rounded brush tip, y = +1).
  const topIndex = positions.length / 3
  positions.push(0, 1, 0)
  pushColor(1, 0, 0.35)

  // Bottom cap fan (outward winding viewed from -Y).
  for (let side = 0; side < sides; side++) {
    const next = (side + 1) % sides
    indices.push(0, 1 + side, 1 + next)
  }

  // Interior rings (outward CCW winding).
  for (let ring = 0; ring < rings - 2; ring++) {
    const r0 = 1 + ring * sides
    const r1 = r0 + sides
    for (let side = 0; side < sides; side++) {
      const next = (side + 1) % sides
      const a = r0 + side
      const b = r0 + next
      const c = r1 + side
      const d = r1 + next
      indices.push(a, c, b, b, c, d)
    }
  }

  // Top cap fan (outward winding viewed from +Y).
  const lastRing = 1 + (rings - 2) * sides
  for (let side = 0; side < sides; side++) {
    const next = (side + 1) % sides
    indices.push(topIndex, lastRing + next, lastRing + side)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/**
 * Watertight tapered wheat awn spanning `y ∈ [-0.5, +0.5]` with a gentle
 * outward arc along local `+X` so awns fan softly like harvested grain.
 */
export function createCurvedAwnGeometry(): THREE.BufferGeometry {
  const segments = 4
  const sides = 5
  const positions: number[] = []
  const indices: number[] = []

  const ringCenter = (t: number): [number, number, number] => [
    // Subtle outward bow peaking just above mid-length, returning slightly at the fine tip.
    Math.sin(t * Math.PI) * 0.011 + t * t * 0.005,
    t - 0.5,
    0,
  ]

  for (let s = 0; s <= segments; s++) {
    const t = s / segments
    const [cx, cy, cz] = ringCenter(t)
    const radius = THREE.MathUtils.lerp(0.0031, 0.0014, t)
    for (let side = 0; side < sides; side++) {
      const angle = (side * Math.PI * 2) / sides
      positions.push(cx + Math.cos(angle) * radius, cy, cz + Math.sin(angle) * radius)
    }
  }

  for (let s = 0; s < segments; s++) {
    const r0 = s * sides
    const r1 = (s + 1) * sides
    for (let side = 0; side < sides; side++) {
      const next = (side + 1) % sides
      indices.push(r0 + side, r1 + side, r0 + next, r1 + side, r1 + next, r0 + next)
    }
  }

  const bottom = positions.length / 3
  positions.push(...ringCenter(0))
  const top = positions.length / 3
  positions.push(...ringCenter(1))
  const lastRing = segments * sides
  for (let side = 0; side < sides; side++) {
    const next = (side + 1) % sides
    indices.push(bottom, side, next)
    indices.push(top, lastRing + next, lastRing + side)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/**
 * Warm stylized golden wheat-kernel material: uses geometry vertex colors
 * (toasted base to sunlit tip + belly groove), soft organic translucency via
 * `ritual-optics` (`kind: 'fruit'`), and gentle husk shading + Komorebi C1
 * highlight shoulder via shared `craft-surfaces` (`kind: 'straw'`).
 */
export function createWheatKernelMaterial(): THREE.MeshStandardMaterial {
  const material = createRitualMaterial(
    { color: 0xffffff, roughness: 0.72, metalness: 0, vertexColors: true },
    { kind: 'fruit', strength: 0.16 },
  )
  applyCraftSurface(material, { kind: 'straw', scale: 0.12, strength: 0.15, axis: 'y' })
  return material
}

/** Subtle deterministic warm-base to sunlit-tip harvest variation per kernel instance. */
export function wheatKernelInstanceColor(
  earIndex: number,
  row: number,
  sideIndex: number,
  out: THREE.Color,
): THREE.Color {
  const rowT = row / 5
  const jitter = Math.sin(earIndex * 2.17 + row * 3.11 + sideIndex * 1.73) * 0.045
  const r = THREE.MathUtils.clamp(THREE.MathUtils.lerp(0.90, 1.04, rowT) + jitter, 0.82, 1.06)
  const g = THREE.MathUtils.clamp(THREE.MathUtils.lerp(0.84, 1.02, rowT) + jitter * 0.85, 0.76, 1.05)
  const b = THREE.MathUtils.clamp(THREE.MathUtils.lerp(0.74, 0.98, rowT) + jitter * 0.6, 0.66, 1.02)
  return out.setRGB(r, g, b, THREE.SRGBColorSpace)
}
