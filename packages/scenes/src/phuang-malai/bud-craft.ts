import * as THREE from 'three'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'

export type MalaiBudVariant = 'jasmine' | 'rose'

const BUD_MIN_Y = -0.043
const BUD_MAX_Y = 0.056
const BUD_SPAN_Y = BUD_MAX_Y - BUD_MIN_Y

/**
 * Builds a single shared watertight closed jasmine/rose bud geometry (`FrontSide`),
 * matching the exact height envelope (`y ∈ [-0.043, +0.056]`) with a gently flared
 * 5-lobed calyx base, plump rounded belly, and soft helical 3+5 folded petal crown.
 */
export function createJasmineBudGeometry(): THREE.BufferGeometry {
  const radialSegments = 14
  const profile: THREE.Vector2[] = [
    new THREE.Vector2(0, BUD_MIN_Y),
    new THREE.Vector2(0.0115, -0.0405),
    new THREE.Vector2(0.0205, -0.0325),
    new THREE.Vector2(0.0268, -0.020),
    new THREE.Vector2(0.0305, -0.004),
    new THREE.Vector2(0.0286, 0.0125),
    new THREE.Vector2(0.0235, 0.0275),
    new THREE.Vector2(0.0155, 0.0425),
    new THREE.Vector2(0.0075, 0.0515),
    new THREE.Vector2(0.0028, 0.055),
    new THREE.Vector2(0, BUD_MAX_Y),
  ]

  const geo = new THREE.LatheGeometry(profile, radialSegments)
  const positions = geo.getAttribute('position')
  const stride = profile.length

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i)
    const y = positions.getY(i)
    const z = positions.getZ(i)
    const r = Math.hypot(x, z)
    if (r < 1e-6) continue

    const a = Math.atan2(z, x)
    const t = THREE.MathUtils.clamp((y - BUD_MIN_Y) / BUD_SPAN_Y, 0, 1)
    const env = Math.sin(t * Math.PI)
    const twist = t * 1.12
    const petalFolds = (Math.cos(a * 3 + twist) * 0.068 + Math.cos(a * 5 - twist * 0.55) * 0.024) * env
    const calyxEnv = t < 0.28 ? Math.sin((t / 0.28) * Math.PI) : 0
    const calyxLobes = Math.cos(a * 5) * 0.042 * calyxEnv
    const scale = 1 + petalFolds + calyxLobes

    positions.setX(i, x * scale)
    positions.setZ(i, z * scale)
  }

  geo.computeVertexNormals()

  // Average normals across the lathe seam (column 0 and column radialSegments) so buds
  // show a continuous soft wrap with zero longitudinal shading seam.
  const normals = geo.getAttribute('normal')
  const n0 = new THREE.Vector3()
  const n1 = new THREE.Vector3()
  for (let row = 0; row < stride; row++) {
    const i0 = row
    const i1 = radialSegments * stride + row
    n0.fromBufferAttribute(normals, i0)
    n1.fromBufferAttribute(normals, i1)
    n0.add(n1).normalize()
    if (Number.isFinite(n0.x) && Number.isFinite(n0.y) && Number.isFinite(n0.z)) {
      normals.setXYZ(i0, n0.x, n0.y, n0.z)
      normals.setXYZ(i1, n0.x, n0.y, n0.z)
    }
  }
  normals.needsUpdate = true
  return geo
}

type BudPalette = {
  baseHex: number
  calyxHex: number
  throatHex: number
  bodyHex: number
  tipHex: number
  scatterTint: readonly [number, number, number]
  bounceTint: readonly [number, number, number]
  roughness: number
  hueAmp: number
}

const BUD_PALETTES: Record<MalaiBudVariant, BudPalette> = {
  jasmine: {
    baseHex: 0xf8eed8,
    calyxHex: 0x769955,
    throatHex: 0xe4e9c2,
    bodyHex: 0xf8eed9,
    tipHex: 0xfff8ea,
    scatterTint: [1.09, 1.00, 0.83],
    bounceTint: [1.08, 1.00, 0.85],
    roughness: 0.84,
    hueAmp: 0.044,
  },
  rose: {
    baseHex: 0xd98396,
    calyxHex: 0x739056,
    throatHex: 0xb1556e,
    bodyHex: 0xdc7f95,
    tipHex: 0xf5c0ca,
    scatterTint: [1.11, 0.88, 0.91],
    bounceTint: [1.08, 0.90, 0.91],
    roughness: 0.85,
    hueAmp: 0.048,
  },
}

const VARYING_DECL = /* glsl */ `
varying vec3 malaiLocalPos;
varying vec3 malaiInstSeed;
`

const FRAG_HEADER = /* glsl */ `
uniform vec3 malaiCalyxColor;
uniform vec3 malaiThroatColor;
uniform vec3 malaiBodyColor;
uniform vec3 malaiTipColor;
uniform vec3 malaiScatterTint;
uniform vec3 malaiBounceTint;
uniform float malaiHueAmp;
`

function attachMalaiBudShader(material: THREE.MeshStandardMaterial, variant: MalaiBudVariant): void {
  const palette = BUD_PALETTES[variant]
  const previousCompile = material.onBeforeCompile
  const baseKey = material.customProgramCacheKey()

  material.onBeforeCompile = function (shader, renderer) {
    previousCompile.call(this, shader, renderer)
    if (shader.fragmentShader.includes('WBR_MALAI_BUD_V1')) return

    shader.uniforms.malaiCalyxColor = { value: new THREE.Color(palette.calyxHex) }
    shader.uniforms.malaiThroatColor = { value: new THREE.Color(palette.throatHex) }
    shader.uniforms.malaiBodyColor = { value: new THREE.Color(palette.bodyHex) }
    shader.uniforms.malaiTipColor = { value: new THREE.Color(palette.tipHex) }
    shader.uniforms.malaiScatterTint = { value: new THREE.Vector3(...palette.scatterTint) }
    shader.uniforms.malaiBounceTint = { value: new THREE.Vector3(...palette.bounceTint) }
    shader.uniforms.malaiHueAmp = { value: palette.hueAmp }

    shader.vertexShader = VARYING_DECL + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */ `
      #include <begin_vertex>
      malaiLocalPos = transformed;
      #ifdef USE_INSTANCING
        // Derive static per-bud warmth/hue variation from instance-local transform so
        // dragging clusters never causes color swimming.
        vec3 mInstOrig = instanceMatrix[3].xyz;
        vec3 mInstAxis = instanceMatrix[1].xyz;
        malaiInstSeed = vec3(
          sin(dot(mInstOrig, vec3(71.3, 43.7, 61.9)) + dot(mInstAxis, vec3(13.1, -9.7, 17.3))),
          sin(dot(mInstOrig, vec3(-53.1, 67.3, 37.9)) + dot(mInstAxis, vec3(8.9, 19.3, -11.7))),
          sin(dot(mInstOrig, vec3(41.7, -31.9, 79.1)) + dot(mInstAxis, vec3(-15.3, 12.1, 7.9)))
        );
      #else
        malaiInstSeed = vec3(0.0);
      #endif
      `,
    )

    shader.fragmentShader =
      '#define WBR_MALAI_BUD_V1\n' + VARYING_DECL + FRAG_HEADER + shader.fragmentShader

    // Warm wrapped direct lighting + soft inter-petal bounce so dense bud clusters
    // never fall into cold dirty grey shadows on back sides.
    const physicalLights = THREE.ShaderChunk.lights_physical_pars_fragment
      .replace(
        'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
        /* glsl */ `
        float mBudT = clamp((malaiLocalPos.y - (${BUD_MIN_Y.toFixed(4)})) / ${BUD_SPAN_Y.toFixed(4)}, 0.0, 1.0);
        float mRawNL = dot(geometryNormal, directLight.direction);
        float mWrap = clamp((mRawNL + 0.64) / 1.64, 0.0, 1.0);
        float mWrapExtra = max(0.0, mWrap - dotNL);
        float mBack = max(0.0, -mRawNL);
        vec3 mThrough = normalize(directLight.direction + geometryNormal * 0.24);
        float mForward = pow(max(0.0, dot(geometryViewDir, -mThrough)), 2.5);
        float mPetalTrans = mBack * (0.58 + 0.42 * mForward) * (0.14 + 0.14 * smoothstep(0.32, 1.0, mBudT));
        reflectedLight.directDiffuse += irradiance * BRDF_Lambert(material.diffuseColor)
          + (mWrapExtra * 0.58 + mPetalTrans) * directLight.color * BRDF_Lambert(material.diffuseColor * malaiScatterTint);
        `,
      )
      .replace(
        'reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
        /* glsl */ `
        float mIrrLuma = dot(irradiance, vec3(0.299, 0.587, 0.114));
        vec3 mWarmIrr = mix(irradiance, vec3(mIrrLuma) * malaiBounceTint, 0.52) * 1.16;
        reflectedLight.indirectDiffuse += mWarmIrr * BRDF_Lambert(material.diffuseColor);
        `,
      )

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <lights_physical_pars_fragment>', physicalLights)
      .replace(
        '#include <color_fragment>',
        /* glsl */ `
        #include <color_fragment>
        float mAxial = clamp((malaiLocalPos.y - (${BUD_MIN_Y.toFixed(4)})) / ${BUD_SPAN_Y.toFixed(4)}, 0.0, 1.0);
        float mAng = atan(malaiLocalPos.z, malaiLocalPos.x);
        float mSepalScallop = 0.050 * (0.5 + 0.5 * cos(mAng * 5.0 + malaiInstSeed.x * 1.6));
        float mCalyxMask = 1.0 - smoothstep(0.18 + mSepalScallop, 0.42 + mSepalScallop, mAxial);
        float mThroatMask = smoothstep(0.20, 0.40, mAxial) * (1.0 - smoothstep(0.40, 0.68, mAxial));
        float mTipMask = smoothstep(0.64, 1.0, mAxial);

        vec3 mGrad = mix(malaiBodyColor, malaiTipColor, mTipMask);
        mGrad = mix(mGrad, malaiThroatColor, mThroatMask * 0.78);
        mGrad = mix(mGrad, malaiCalyxColor, mCalyxMask * 0.92);

        // Preserve subtle per-instance color multiplier from InstancedMesh.setColorAt.
        vec3 mRefBody = max(malaiBodyColor, vec3(0.01));
        vec3 mRatio = clamp(diffuseColor.rgb / mRefBody, vec3(0.86), vec3(1.14));
        vec3 mInstTint = vec3(
          1.0 + (malaiInstSeed.x * 0.75 + malaiInstSeed.y * 0.35) * malaiHueAmp,
          1.0 + (malaiInstSeed.y * 0.65 - malaiInstSeed.z * 0.30) * malaiHueAmp,
          1.0 + (-malaiInstSeed.x * 0.85 + malaiInstSeed.z * 0.55) * malaiHueAmp
        );

        // Delicate AA-guarded spiral petal-overlap creases on the upper bud.
        float mFoldPhase = mAng * 3.0 + mAxial * 1.12;
        float mFoldFw = fwidth(mFoldPhase);
        float mFold = cos(mFoldPhase) * exp(-0.42 * mFoldFw * mFoldFw) * sin(mAxial * 3.14159) * (1.0 - mCalyxMask);
        diffuseColor.rgb = mGrad * mix(vec3(1.0), mRatio, 0.65) * mInstTint * (1.0 + mFold * 0.048);
        `,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `
        #include <roughnessmap_fragment>
        float mRoughT = clamp((malaiLocalPos.y - (${BUD_MIN_Y.toFixed(4)})) / ${BUD_SPAN_Y.toFixed(4)}, 0.0, 1.0);
        float mRoughCalyx = 1.0 - smoothstep(0.14, 0.34, mRoughT);
        roughnessFactor = clamp(roughnessFactor - mRoughCalyx * 0.09 - smoothstep(0.68, 1.0, mRoughT) * 0.04, 0.58, 0.96);
        `,
      )
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `
        // C1 asymptotic highlight shoulder (knee = 0.74, headroom = 0.24) prevents blown
        // highlights on sunlit white jasmine and pale blush tips under Komorebi daylight.
        vec3 mLit = max(outgoingLight - totalEmissiveRadiance, vec3(0.0));
        float mPeak = max(mLit.r, max(mLit.g, mLit.b));
        if (mPeak > 0.74) {
          float mExcess = mPeak - 0.74;
          float mTarget = 0.74 + 0.24 * (mExcess / (mExcess + 0.24));
          outgoingLight = mLit * (mTarget / mPeak) + totalEmissiveRadiance;
        }
        #include <opaque_fragment>
        `,
      )
  }

  material.customProgramCacheKey = () => `${baseKey}|wbr-malai-bud-v1:${variant}`
  // Preserve this procedural hook when toon-surfaces clones the material in toon-soft.
  material.clone = function (this: THREE.MeshStandardMaterial) {
    const cloned = THREE.MeshStandardMaterial.prototype.clone.call(this) as THREE.MeshStandardMaterial
    attachMalaiBudShader(cloned, variant)
    return cloned
  }
  material.needsUpdate = true
}

/**
 * Textureless, single-pass procedural botanical material for Phuang Malai buds
 * (calyx-green base -> warm ivory/rose body -> luminous pearl tip, warm wrap scatter,
 * per-instance hue variation, and C1 highlight protection).
 */
export function createMalaiBudMaterial(variant: MalaiBudVariant): THREE.MeshStandardMaterial {
  const palette = BUD_PALETTES[variant]
  const material = createRitualMaterial(
    {
      color: palette.baseHex,
      roughness: palette.roughness,
      metalness: 0,
      side: THREE.FrontSide,
    },
    { kind: 'fruit', strength: 0.14 },
  )
  attachMalaiBudShader(material, variant)
  return material
}
