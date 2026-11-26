import * as THREE from 'three'
import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'

function woodHash(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

function periodicWoodNoise(x: number, y: number, px: number, py: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y)
  const fx = x - xi, fy = y - yi
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10)
  const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10)
  const x0 = ((xi % px) + px) % px, x1 = (x0 + 1) % px
  const y0 = ((yi % py) + py) % py, y1 = (y0 + 1) % py
  const a = woodHash(x0, y0, seed), b = woodHash(x1, y0, seed)
  const c = woodHash(x0, y1, seed), d = woodHash(x1, y1, seed)
  return (a + (b - a) * ux) + ((c + (d - c) * ux) - (a + (b - a) * ux)) * uy
}

function wrapPeriodicDelta(a: number, b: number): number {
  let d = a - b
  if (d > 0.5) d -= 1
  else if (d < -0.5) d += 1
  return d
}

type KanteleCathedral = {
  along: number
  across: number
  widthAlong: number
  widthAcross: number
  lift: number
}

type KanteleKnot = {
  along: number
  across: number
  ra: number
  rc: number
  deflect: number
  depth: number
  tilt?: number
}

type KanteleWoodSpec = {
  key: string
  light: readonly [number, number, number]
  dark: readonly [number, number, number]
  warm: readonly [number, number, number]
  knot?: readonly [number, number, number]
  orientation: 'u' | 'v'
  rings: number
  spread: number
  arch: number
  wobble: number
  cathedrals?: readonly KanteleCathedral[]
  knots?: readonly KanteleKnot[]
  repeat: readonly [number, number]
  offset?: readonly [number, number]
  seed: number
}

const cachedKanteleWood = new Map<string, { color: Uint8Array; bump: Uint8Array; size: number }>()

/**
 * Deterministic stylized spruce/birch wood DataTexture (256x256, zero DOM/Canvas2D dependency):
 * non-uniform growth-ring spacing, flowing cathedral arches, and sparse warm stylized knots ("木眼")
 * with organic grain parting for the carved kantele soundboard, hollow rim, tuning-pin rail and bridge.
 */
function createKanteleWoodTextures(spec: KanteleWoodSpec): { map: THREE.DataTexture; bump: THREE.DataTexture } {
  const size = 256
  let cached = cachedKanteleWood.get(spec.key)
  if (!cached) {
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2
    const knotRgb: readonly [number, number, number] = spec.knot ?? [
      Math.max(28, Math.round(spec.dark[0] * 0.72)),
      Math.max(20, Math.round(spec.dark[1] * 0.68)),
      Math.max(14, Math.round(spec.dark[2] * 0.64)),
    ]
    const phaseA = woodHash(spec.seed, 19, 5)
    const phaseB = woodHash(spec.seed, 31, 11)
    for (let y = 0; y < size; y++) {
      const v = y / size
      for (let x = 0; x < size; x++) {
        const u = x / size
        const along = spec.orientation === 'u' ? u : v
        const across = spec.orientation === 'u' ? v : u

        // Monotonic non-uniform ring spacing breaks mechanical parallel striping.
        const acrossVar = across
          + (spec.spread / tau) * Math.sin((across + phaseA) * tau)
          + ((spec.spread * 0.44) / tau) * Math.sin((across * 2 + phaseB) * tau)

        const wash = periodicWoodNoise(along * 2, across * 2, 2, 2, spec.seed + 13)
        const broadFlow = (periodicWoodNoise(along * 2, across * 2, 2, 2, spec.seed + 29) - 0.5) * spec.wobble
        const midFlow = (periodicWoodNoise(along * 3, across * 5, 3, 5, spec.seed + 43) - 0.5) * spec.wobble * 0.44
        const bow = Math.sin((along + phaseA) * tau) * spec.arch
          + Math.sin((along * 2 + phaseB) * tau) * spec.arch * 0.36

        let cathedralLift = 0
        if (spec.cathedrals) {
          for (const c of spec.cathedrals) {
            const da = wrapPeriodicDelta(along, c.along)
            const dc = wrapPeriodicDelta(across, c.across)
            cathedralLift += c.lift * Math.exp(-((da / c.widthAlong) ** 2 + (dc / c.widthAcross) ** 2))
          }
        }

        let knotDeflect = 0
        let knotTone = 0
        let knotGlow = 0
        if (spec.knots) {
          for (let ki = 0; ki < spec.knots.length; ki++) {
            const k = spec.knots[ki]!
            const da0 = wrapPeriodicDelta(along, k.along)
            const dc0 = wrapPeriodicDelta(across, k.across)
            const tilt = k.tilt ?? 0
            const cosT = Math.cos(tilt), sinT = Math.sin(tilt)
            const da = da0 * cosT + dc0 * sinT
            const dc = -da0 * sinT + dc0 * cosT
            const wakeA = da / (k.ra * 2.8)
            const wakeC = dc / (k.rc * 2.2)
            const wake = Math.exp(-(wakeA * wakeA + wakeC * wakeC))
            knotDeflect -= k.deflect * Math.tanh(dc / Math.max(k.rc * 0.85, 0.005)) * wake

            const ell = Math.hypot(da / k.ra, dc / k.rc)
            if (ell < 1.75) {
              const kw = (periodicWoodNoise(along * 6, across * 6, 6, 6, spec.seed + 137 + ki * 19) - 0.5) * 0.14
              const ed = Math.max(0, ell + kw * THREE.MathUtils.smoothstep(ell, 0.15, 0.92))
              const collar = Math.exp(-(((ed - 0.96) / 0.25) ** 2)) * 0.36 * k.depth
              const inside = 1 - THREE.MathUtils.smoothstep(ed, 0.78, 1.08)
              const swirl = 0.5 + 0.5 * Math.sin(ed * 15.0 + (da / Math.max(k.ra, 0.01)) * 0.55)
              const core = 1 - THREE.MathUtils.smoothstep(ed, 0.14, 0.56)
              knotTone = Math.max(knotTone, Math.min(1, inside * (0.44 + 0.30 * swirl + 0.44 * core) * k.depth + collar))
              knotGlow = Math.max(knotGlow, Math.exp(-(((ed - 1.24) / 0.28) ** 2)) * 0.18 * k.depth)
            }
          }
        }

        const ringPos = acrossVar * spec.rings + bow + broadFlow + midFlow + cathedralLift + knotDeflect
        const frac = ringPos - Math.floor(ringPos)
        const rampUp = THREE.MathUtils.smoothstep(frac, 0.07, 0.74)
        const rampDown = 1 - THREE.MathUtils.smoothstep(frac, 0.74, 0.98)
        const primaryRing = Math.pow(Math.min(rampUp, rampDown), 1.30)
        const secFrac = (ringPos * 2.0 + 0.26) - Math.floor(ringPos * 2.0 + 0.26)
        const secondaryRing = Math.pow(Math.min(THREE.MathUtils.smoothstep(secFrac, 0.12, 0.65), 1 - THREE.MathUtils.smoothstep(secFrac, 0.65, 0.96)), 1.6) * 0.20
        const softMod = 0.62 + 0.52 * periodicWoodNoise(along * 2, across * 3, 2, 3, spec.seed + 61)
        const fiber = periodicWoodNoise(along * 4, across * 28, 4, 28, spec.seed + 79) - 0.5

        const grainMix = THREE.MathUtils.clamp((primaryRing * 0.76 + secondaryRing) * softMod + fiber * 0.09, 0, 1)
        const warmMix = THREE.MathUtils.clamp(wash * 0.48 + knotGlow, 0, 1)
        const baseR = THREE.MathUtils.lerp(spec.light[0], spec.warm[0], warmMix)
        const baseG = THREE.MathUtils.lerp(spec.light[1], spec.warm[1], warmMix)
        const baseB = THREE.MathUtils.lerp(spec.light[2], spec.warm[2], warmMix)

        const gR = THREE.MathUtils.lerp(baseR, spec.dark[0], grainMix)
        const gG = THREE.MathUtils.lerp(baseG, spec.dark[1], grainMix)
        const gB = THREE.MathUtils.lerp(baseB, spec.dark[2], grainMix)

        const i = (y * size + x) * 4
        color[i] = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(gR, knotRgb[0], knotTone)), 0, 255)
        color[i + 1] = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(gG, knotRgb[1], knotTone)), 0, 255)
        color[i + 2] = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(gB, knotRgb[2], knotTone)), 0, 255)
        color[i + 3] = 255

        const h = THREE.MathUtils.clamp(Math.round(128 - primaryRing * 20 * softMod + fiber * 10 - knotTone * 22), 60, 194)
        bump[i] = h; bump[i + 1] = h; bump[i + 2] = h; bump[i + 3] = 255
      }
    }
    cached = { color, bump, size }
    cachedKanteleWood.set(spec.key, cached)
  }

  const map = new THREE.DataTexture(new Uint8Array(cached.color), size, size)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.repeat.set(spec.repeat[0], spec.repeat[1])
  if (spec.offset) map.offset.set(spec.offset[0], spec.offset[1])
  map.magFilter = THREE.LinearFilter
  map.minFilter = THREE.LinearMipmapLinearFilter
  map.generateMipmaps = true
  map.anisotropy = 4
  map.needsUpdate = true

  const bump = new THREE.DataTexture(new Uint8Array(cached.bump), size, size)
  bump.colorSpace = THREE.NoColorSpace
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping
  bump.repeat.set(spec.repeat[0], spec.repeat[1])
  if (spec.offset) bump.offset.set(spec.offset[0], spec.offset[1])
  bump.magFilter = THREE.LinearFilter
  bump.minFilter = THREE.LinearMipmapLinearFilter
  bump.generateMipmaps = true
  bump.anisotropy = 4
  bump.needsUpdate = true

  return { map, bump }
}

function createKanteleWoodMaterial(
  spec: KanteleWoodSpec,
  opts: { axis: 'x' | 'y' | 'z'; roughness: number; clearcoat?: number; clearcoatRoughness?: number; bumpScale: number; scale?: number; strength?: number },
): THREE.MeshStandardMaterial {
  const tex = createKanteleWoodTextures(spec)
  const mat = opts.clearcoat
    ? new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: tex.map,
      bumpMap: tex.bump,
      bumpScale: opts.bumpScale,
      roughness: opts.roughness,
      metalness: 0,
      clearcoat: opts.clearcoat,
      clearcoatRoughness: opts.clearcoatRoughness ?? .42,
      envMapIntensity: .74,
    })
    : new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: tex.map,
      bumpMap: tex.bump,
      bumpScale: opts.bumpScale,
      roughness: opts.roughness,
      metalness: 0,
    })
  const release = () => {
    mat.removeEventListener('dispose', release)
    tex.map.dispose()
    tex.bump.dispose()
  }
  mat.addEventListener('dispose', release)
  return applyCraftSurface(mat, { kind: 'wood', axis: opts.axis, scale: opts.scale ?? .68, strength: opts.strength ?? .16 })
}

export function createKanteleModel() {
  const subject=new THREE.Group(),fixed=new THREE.Group();subject.name='kantele-subject';fixed.name='kantele-fixed';subject.add(fixed)
  // Distinct warm spruce/birch variation and grain scales across carved frame sides,
  // wide-flowing non-repeating soundboard, toasted curly-birch tuning-pin rail grips,
  // vertical walnut-alder tuning pegs, and darker anchor bridge blocks.
  const rimWood = createKanteleWoodMaterial(
    {
      key: 'kantele-birch-rim-v3',
      light: [176, 122, 72],
      dark: [120, 74, 38],
      warm: [192, 138, 84],
      knot: [86, 48, 22],
      orientation: 'u',
      rings: 6.4,
      spread: 0.44,
      arch: .52,
      wobble: .84,
      cathedrals: [{ along: 0.34, across: 0.42, widthAlong: 0.25, widthAcross: 0.24, lift: 1.55 }],
      knots: [{ along: 0.62, across: 0.42, ra: 0.068, rc: 0.044, deflect: 0.96, depth: 0.88, tilt: 0.06 }],
      repeat: [.40, 1.60],
      offset: [.34, .0],
      seed: 19,
    },
    { axis: 'x', roughness: .70, clearcoat: .18, clearcoatRoughness: .40, bumpScale: .0026, scale: .76, strength: .15 },
  )
  const topWood = createKanteleWoodMaterial(
    {
      key: 'kantele-spruce-top-v4',
      light: [216, 174, 114],
      dark: [164, 116, 66],
      warm: [228, 190, 130],
      knot: [122, 80, 42],
      orientation: 'u',
      rings: 7.2,
      spread: 0.50,
      arch: .64,
      wobble: .98,
      cathedrals: [
        { along: 0.48, across: 0.56, widthAlong: 0.26, widthAcross: 0.24, lift: 2.15 },
        { along: 0.82, across: 0.68, widthAlong: 0.22, widthAcross: 0.22, lift: -1.45 },
      ],
      knots: [
        // Front-left & front-right open spruce soundboard, clear of the circular sound hole (tex ~ 0.554, 0.157).
        { along: 0.35, across: 0.17, ra: 0.048, rc: 0.033, deflect: 1.05, depth: 0.78, tilt: 0.07 },
        { along: 0.74, across: 0.18, ra: 0.038, rc: 0.026, deflect: 0.82, depth: 0.74, tilt: -0.09 },
      ],
      repeat: [.27, .54],
      offset: [.50, .50],
      seed: 37,
    },
    { axis: 'x', roughness: .74, clearcoat: .16, clearcoatRoughness: .44, bumpScale: .0024, scale: .42, strength: .11 },
  )
  const pegGripWarm = createKanteleWoodMaterial(
    {
      key: 'kantele-grip-birch-a-v3',
      light: [198, 146, 92],
      dark: [142, 94, 52],
      warm: [212, 162, 106],
      orientation: 'u',
      rings: 6.0,
      spread: 0.38,
      arch: .36,
      wobble: .56,
      repeat: [.92, .88],
      offset: [.12, .18],
      seed: 43,
    },
    { axis: 'x', roughness: .64, clearcoat: .14, clearcoatRoughness: .42, bumpScale: .0020, scale: 1.06, strength: .18 },
  )
  const pegGripToasted = createKanteleWoodMaterial(
    {
      key: 'kantele-grip-birch-b-v3',
      light: [186, 134, 82],
      dark: [130, 84, 46],
      warm: [200, 148, 96],
      orientation: 'u',
      rings: 6.8,
      spread: 0.42,
      arch: .40,
      wobble: .62,
      repeat: [.86, .95],
      offset: [.47, .33],
      seed: 49,
    },
    { axis: 'x', roughness: .64, clearcoat: .14, clearcoatRoughness: .42, bumpScale: .0020, scale: 1.18, strength: .18 },
  )
  const pegWood = createKanteleWoodMaterial(
    {
      key: 'kantele-peg-walnut-v3',
      light: [128, 84, 52],
      dark: [88, 54, 32],
      warm: [142, 98, 64],
      orientation: 'v',
      rings: 4.8,
      spread: 0.34,
      arch: .26,
      wobble: .42,
      repeat: [1, 1],
      seed: 53,
    },
    { axis: 'y', roughness: .60, bumpScale: .0020, scale: 1.24, strength: .22 },
  )
  const bridgeWood = createKanteleWoodMaterial(
    {
      key: 'kantele-bridge-walnut-v3',
      light: [132, 86, 54],
      dark: [90, 54, 32],
      warm: [146, 100, 66],
      orientation: 'u',
      rings: 5.2,
      spread: 0.36,
      arch: .30,
      wobble: .46,
      repeat: [1, 1],
      seed: 71,
    },
    { axis: 'x', roughness: .62, bumpScale: .0020, scale: .96, strength: .19 },
  )
  const steel=new THREE.MeshStandardMaterial({color:'#9daea9',metalness:.78,roughness:.38})
  const add=(name:string,g:THREE.BufferGeometry,mat:THREE.MeshStandardMaterial,parent:THREE.Object3D,x=0,y=0,z=0)=>{const mesh=new THREE.Mesh(g,mat);mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh}
  const outline=[[-1.72,-.82],[1.62,-.82],[1.62,.82],[-.70,.82]]
  const polygon=(scale=1)=>new THREE.Shape(outline.map(([x,z])=>new THREE.Vector2(x!*scale,-z!*scale)))
  const rimShape=polygon();rimShape.holes.push(new THREE.Path(outline.map(([x,z])=>new THREE.Vector2(x!*.90,-z!*.90)).reverse()))
  const slab=(shape:THREE.Shape,depth:number,bevel=false)=>{const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:bevel,bevelSegments:1,steps:1,bevelSize:.02,bevelThickness:.02,curveSegments:32});for(const key of ['position','normal']){const p=g.getAttribute(key);for(let i=0;i<p.count;i++){const y=p.getY(i),z=p.getZ(i);p.setY(i,z);p.setZ(i,-y)}}return g}
  const rim=add('kantele-hollow-rim',slab(rimShape,.24),rimWood,fixed)
  const topShape=polygon(),hole=new THREE.Path();hole.absarc(.20,-.635,.085,0,Math.PI*2,false);topShape.holes.push(hole)
  const top=add('kantele-soundboard',slab(topShape,.12,true),topWood,fixed,0,.24)
  const pegs:THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>[]=[],radius=.020
  for(let i=0;i<5;i++){const x=-1.45+i*.14,z=-.52+i*.26;pegs.push(add(`kantele-peg-${i}`,new THREE.CylinderGeometry(.075,.075,.28,16),pegWood,fixed,x,.50,z));add(`kantele-peg-grip-${i}`,new THREE.BoxGeometry(.20,.06,.09),i%2===0?pegGripWarm:pegGripToasted,fixed,x,.65,z)}
  for(const [i,z]of[-.67,.67].entries())add(`kantele-anchor-support-${i}`,new THREE.BoxGeometry(.17,.15,.16),bridgeWood,fixed,1.32,.435,z)
  const bar=add('kantele-anchor-bar',new THREE.CylinderGeometry(.045,.045,1.42,20),steel,fixed,1.32,.49);bar.rotation.x=Math.PI/2
  const frames=32,sides=8
  const wireGeometry=()=>{const g=new THREE.BufferGeometry(),indices:number[]=[];g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(((frames+1)*sides+2)*3),3).setUsage(THREE.DynamicDrawUsage));for(let i=0;i<frames;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides,c=(i+1)*sides+j,d=(i+1)*sides+(j+1)%sides;indices.push(a,b,c,b,d,c)}const start=(frames+1)*sides,end=start+1;for(let j=0;j<sides;j++){indices.push(start,(j+1)%sides,j,end,frames*sides+j,frames*sides+(j+1)%sides)}g.setIndex(indices);return g}
  const wires=Array.from({length:5},(_,i)=>add(`kantele-string-${i}`,wireGeometry(),steel,subject,0,.49,-.52+i*.26))
  const deform=(i:number,d:number)=>{const wire=wires[i]!,p=wire.geometry.getAttribute('position') as THREE.BufferAttribute,start=-1.39+i*.14,end=1.29;for(let n=0;n<=frames;n++){const t=n/frames,z=(n===0||n===frames)?0:Math.sin(Math.PI*t)*d;for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2;p.setXYZ(n*sides+j,THREE.MathUtils.lerp(start,end,t),Math.cos(a)*radius,z+Math.sin(a)*radius)}}p.setXYZ((frames+1)*sides,start,0,0);p.setXYZ((frames+1)*sides+1,end,0,0);p.needsUpdate=true;wire.geometry.computeVertexNormals();wire.geometry.computeBoundingBox();wire.geometry.computeBoundingSphere()}
  const displacement=(n:number)=>{if(n===0||n===1)return 0;if(n<=.6)return .12*n/.6;const u=(n-.6)/.4;return .12*(1-u)**2*Math.cos(5*Math.PI*u)}
  const pose=(at:number,n:number)=>{const step=THREE.MathUtils.clamp(Math.floor(at),0,3),amount=THREE.MathUtils.clamp(n,0,1);for(let i=0;i<5;i++)deform(i,step<3&&i===step*2?displacement(amount)*(step===1?1:-1):0);subject.updateMatrixWorld(true)}
  pose(0,0)
  const targets=[wires[0]!,wires[2]!,wires[4]!],anchors:[number,number,number][]=[[-.05,0,0],[.09,0,0],[.23,0,0]]
  return{subject,fixed,rim,top,wires,pegs,bar,radius,pose,targets,roots:targets,anchors}
}
