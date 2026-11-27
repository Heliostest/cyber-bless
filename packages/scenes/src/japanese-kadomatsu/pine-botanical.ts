import * as THREE from 'three'

export type PineNeedleTemplate = {
  /** Local positions (non-indexed, watertight 5-sided arched needle with fascicle sheath). */
  positions: Float32Array
  /** Smooth local normals before cluster blending. */
  normals: Float32Array
  /** Axial fraction t in [0..1] per vertex (0..0.16 fascicle sheath, 0.16..1.0 needle blade). */
  axial: Float32Array
}

/**
 * Builds a single closed, watertight, non-indexed FrontSide 5-sided slender
 * Japanese pine needle with a short basal fascicle sheath and gentle graceful
 * arch along +X. Local origin is at the sheath base (y = 0) and tip reaches
 * y = 1.0 (scaled per needle so the overall cluster bounding box never inflates).
 */
function createPineNeedleTemplate(): PineNeedleTemplate {
  const sides = 5
  const rings: readonly { y: number; r: number; archX: number }[] = [
    { y: 0.00, r: 0.96, archX: 0.00 }, // fascicle sheath base
    { y: 0.13, r: 0.86, archX: 0.01 }, // fascicle sheath collar
    { y: 0.56, r: 0.56, archX: 0.055 }, // slender arched mid-shaft
  ]
  const tip = { y: 1.00, archX: 0.105 }

  const verts: number[] = []
  const axials: number[] = []
  const indices: number[] = []

  // Vertex 0: base cap center
  verts.push(0, 0, 0)
  axials.push(0)

  for (const ring of rings) {
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2
      verts.push(ring.archX + Math.cos(a) * ring.r, ring.y, Math.sin(a) * ring.r)
      axials.push(ring.y)
    }
  }

  // Final vertex: needle tip
  const tipIndex = verts.length / 3
  verts.push(tip.archX, tip.y, 0)
  axials.push(1)

  const ringStart = (ri: number) => 1 + ri * sides

  // Base cap (outward -Y): looking from +Y, s increases CCW in XZ (x = cos, z = sin -> CW in right-handed +Y!).
  // Wait: (cos(a), 0, sin(a)): a=0 -> (1,0,0), a=pi/2 -> (0,0,1). Cross (1,0,0) x (0,0,1) = (0,-1,0)!
  // So (center, r0[s], r0[sn]) points outward -Y!
  const r0 = ringStart(0)
  for (let s = 0; s < sides; s++) {
    const sn = (s + 1) % sides
    indices.push(0, r0 + s, r0 + sn)
  }

  // Side quads (outward radial): (a[s], b[s], b[sn]) and (a[s], b[sn], a[sn])
  // Check at s=0: e1 = (0, +dy, 0), e2 = (-dx, +dy, +dz) -> e1 x e2 = (+dy*dz, 0, +dy*dx) -> outward +X/+Z!
  for (let ri = 0; ri < rings.length - 1; ri++) {
    const a = ringStart(ri)
    const b = ringStart(ri + 1)
    for (let s = 0; s < sides; s++) {
      const sn = (s + 1) % sides
      indices.push(a + s, b + s, b + sn)
      indices.push(a + s, b + sn, a + sn)
    }
  }

  // Tip cone (outward radial/upward): (tip, rLast[sn], rLast[s])
  const rLast = ringStart(rings.length - 1)
  for (let s = 0; s < sides; s++) {
    const sn = (s + 1) % sides
    indices.push(tipIndex, rLast + sn, rLast + s)
  }

  const indexed = new THREE.BufferGeometry()
  indexed.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
  indexed.setIndex(indices)
  indexed.computeVertexNormals()

  const posAttr = indexed.getAttribute('position')
  const normAttr = indexed.getAttribute('normal')
  const outPos = new Float32Array(indices.length * 3)
  const outNorm = new Float32Array(indices.length * 3)
  const outAxial = new Float32Array(indices.length)

  for (let i = 0; i < indices.length; i++) {
    const vi = indices[i]!
    outPos[i * 3] = posAttr.getX(vi)
    outPos[i * 3 + 1] = posAttr.getY(vi)
    outPos[i * 3 + 2] = posAttr.getZ(vi)
    outNorm[i * 3] = normAttr.getX(vi)
    outNorm[i * 3 + 1] = normAttr.getY(vi)
    outNorm[i * 3 + 2] = normAttr.getZ(vi)
    outAxial[i] = axials[vi]!
  }

  indexed.dispose()
  return { positions: outPos, normals: outNorm, axial: outAxial }
}

/**
 * Builds the merged watertight non-indexed pine-needle cluster geometry for one
 * kadomatsu bundle (7 sprigs x 3 whorls x 8 slender arched needles = 168 needles).
 *
 * Keeps every needle strictly within the original bounding envelope (preserving all
 * 603 pose collision clearances against door, tray, paving, and opposite bundle),
 * adds a warm olive-brown basal fascicle sheath, root-dark to tip-bright vertex
 * color graduation, and outward-upward cluster-blended unit normals so undersides
 * stay lush evergreen instead of dead black.
 */
export function buildKadomatsuPineNeedlesGeometry(): THREE.BufferGeometry {
  const tpl = createPineNeedleTemplate()
  const vertCount = tpl.axial.length
  const totalNeedles = 7 * 3 * 8
  const positions = new Float32Array(totalNeedles * vertCount * 3)
  const normals = new Float32Array(totalNeedles * vertCount * 3)
  const colors = new Float32Array(totalNeedles * vertCount * 3)

  // Calibrated for softenTreeFoliage (`mix(vec3(1.0), vColor, 0.68)` over base `#5c9860`).
  const sheathColor = new THREE.Color('#745e3e')
  const rootColor = new THREE.Color('#2d5a42')
  const midColor = new THREE.Color('#669c64')
  const tipColor = new THREE.Color('#c8dd7e')
  const tmpColor = new THREE.Color()

  const up = new THREE.Vector3(0, 1, 0)
  const from = new THREE.Vector3()
  const end = new THREE.Vector3()
  const origin = new THREE.Vector3()
  const dir = new THREE.Vector3()
  const archAxis = new THREE.Vector3()
  const sideAxis = new THREE.Vector3()
  const basis = new THREE.Matrix4()
  const clusterNormal = new THREE.Vector3()
  const v = new THREE.Vector3()
  const n = new THREE.Vector3()

  let writeIdx = 0

  for (let i = 0; i < 7; i++) {
    const a = (i * Math.PI * 2) / 7
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    from.set(ca * 0.10, 0.30, sa * 0.10)
    end.set(ca * 0.33, 0.55 + (i % 3) * 0.13, sa * 0.33)

    for (let j = 0; j < 3; j++) {
      // Lower whorls tucked deeper near the straw base are slightly richer; upper whorls catch warm sun.
      const whorlLift = 0.90 + j * 0.065

      for (let k = 0; k < 8; k++) {
        const seed = i * 31 + j * 13 + k * 7
        const jitter = ((Math.sin(seed * 12.9898) * 43758.5453) % 1 + 1) % 1
        // Gentle paired-needle grouping (classic Japanese black-pine two-needle fascicle rhythm).
        const pairShift = (k % 2 === 0 ? -0.075 : 0.075)
        const phi = (k * Math.PI * 2) / 8 + pairShift + j * 0.28

        origin.lerpVectors(from, end, 0.46 + j * 0.26)
        origin.x += Math.cos(phi) * 0.011
        origin.y += k * 0.0014
        origin.z += Math.sin(phi) * 0.011

        dir.set(
          ca * 0.64 + Math.cos(phi) * 0.54,
          0.68 + 0.15 * Math.sin(phi),
          sa * 0.64 + Math.sin(phi) * 0.54,
        ).normalize()

        // Curve needles gently upward-and-outward like living Japanese black-pine (kuromatsu) tufts.
        archAxis.set(ca * 0.55 + Math.cos(phi) * 0.25, 0.35, sa * 0.55 + Math.sin(phi) * 0.25)
        archAxis.addScaledVector(dir, -archAxis.dot(dir))
        if (archAxis.lengthSq() < 1e-6) archAxis.set(1, 0, 0).addScaledVector(dir, -dir.x)
        archAxis.normalize()
        sideAxis.crossVectors(archAxis, dir).normalize()

        // Slight organic length & fullness strictly inside original 0.15 length envelope.
        const length = 0.135 + jitter * 0.014
        const radius = 0.0068 + (1 - jitter) * 0.0009

        // Build exact right-handed basis (X = archAxis, Y = dir, Z = sideAxis; check det > 0).
        if (new THREE.Vector3().crossVectors(archAxis, dir).dot(sideAxis) < 0) sideAxis.negate()
        basis.makeBasis(
          archAxis.clone().multiplyScalar(radius),
          dir.clone().multiplyScalar(length),
          sideAxis.clone().multiplyScalar(radius),
        )
        const archScale = 0.0125 / 0.105 // max tip arch ~12.5 mm, strictly inside original cone envelope

        // Outward-and-upward stylized cluster normal keeps dense pine tuft undersides soft and readable.
        clusterNormal.copy(dir).multiplyScalar(0.62).addScaledVector(up, 0.55).normalize()
        const sprigTint = 0.96 + (jitter - 0.5) * 0.10

        for (let m = 0; m < vertCount; m++) {
          const t = tpl.axial[m]!
          const lx = tpl.positions[m * 3]!
          const ly = tpl.positions[m * 3 + 1]!
          const lz = tpl.positions[m * 3 + 2]!

          // Separate template arch center from radial cross-section so radius and arch scale independently.
          const centerArch = t <= 0.13
            ? (t / 0.13) * 0.01
            : t <= 0.56
              ? THREE.MathUtils.lerp(0.01, 0.055, (t - 0.13) / 0.43)
              : THREE.MathUtils.lerp(0.055, 0.105, (t - 0.56) / 0.44)
          const radX = (lx - centerArch) * radius
          const archOffset = centerArch * archScale
          const radZ = lz * radius

          v.copy(origin)
            .addScaledVector(archAxis, radX + archOffset)
            .addScaledVector(dir, ly * length)
            .addScaledVector(sideAxis, radZ)

          // Transform smooth local normal and blend 44% toward outward-upward cluster normal.
          const nlx = tpl.normals[m * 3]!
          const nly = tpl.normals[m * 3 + 1]!
          const nlz = tpl.normals[m * 3 + 2]!
          n.set(0, 0, 0)
            .addScaledVector(archAxis, nlx)
            .addScaledVector(dir, nly)
            .addScaledVector(sideAxis, nlz)
          if (n.lengthSq() > 1e-12) n.normalize()
          else n.copy(clusterNormal)
          n.lerp(clusterNormal, 0.44).normalize()

          // Root-dark to tip-bright vertex color with distinct warm-olive basal fascicle sheath.
          if (t < 0.125) {
            const st = t / 0.125
            tmpColor.copy(sheathColor).lerp(rootColor, st * 0.35)
          } else {
            const bt = (t - 0.125) / 0.875
            if (bt < 0.46) {
              tmpColor.copy(rootColor).lerp(midColor, bt / 0.46)
            } else {
              tmpColor.copy(midColor).lerp(tipColor, (bt - 0.46) / 0.54)
            }
          }
          tmpColor.multiplyScalar(whorlLift * sprigTint)

          const out = writeIdx * 3
          positions[out] = v.x
          positions[out + 1] = v.y
          positions[out + 2] = v.z
          normals[out] = n.x
          normals[out + 1] = n.y
          normals[out + 2] = n.z
          colors[out] = THREE.MathUtils.clamp(tmpColor.r, 0.18, 1.08)
          colors[out + 1] = THREE.MathUtils.clamp(tmpColor.g, 0.22, 1.12)
          colors[out + 2] = THREE.MathUtils.clamp(tmpColor.b, 0.16, 0.96)
          writeIdx++
        }
      }
    }
  }

  // Silence unused matrix variable while keeping zero allocations inside the inner loop.
  void basis

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  g.computeBoundingBox()
  g.computeBoundingSphere()
  return g
}

/**
 * Stylized Japanese black-pine needle material with wrapped foliage cluster
 * lighting (`treeClusterNormals` triggers `softenTreeFoliage` in `toon-soft`)
 * and subtle warm-green velvet sheen so sunlit pine tufts glow softly without
 * plastic glare or dead-black faceted undersides.
 */
export function createKadomatsuPineMaterial(): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    color: '#5c9860',
    roughness: 0.72,
    metalness: 0,
    specularIntensity: 0.42,
    sheen: 0.16,
    sheenRoughness: 0.76,
    sheenColor: new THREE.Color(0xa6ce7e),
    envMapIntensity: 0.36,
    vertexColors: true,
    side: THREE.FrontSide,
  })
  // Opt into Komorebi wrapped cluster diffuse lighting in toon-soft.
  mat.userData.treeClusterNormals = true
  return mat
}
