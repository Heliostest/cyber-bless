import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import * as THREE from 'three'

const TUNG_X_MIN = 0.035
const TUNG_X_MAX = 0.30
const TUNG_W = TUNG_X_MAX - TUNG_X_MIN
const TUNG_Y_TOP = 1.48
const TUNG_Y_TIP = 0.48
const TUNG_H = TUNG_Y_TOP - TUNG_Y_TIP
const TUNG_THICKNESS = 0.0026
const TUNG_HALF_T = TUNG_THICKNESS * 0.5

// Columns align directly with the twin serrated swallowtail vertices (0.035, 0.10, 0.17, 0.235, 0.30).
const TUNG_XS = [
 0.035, 0.0567, 0.0783, 0.10, 0.1233, 0.1467, 0.17, 0.1917, 0.2133, 0.235, 0.2567, 0.2783, 0.30,
] as const

// Main rows place vertices directly on and closely flanking the three quarter-folds (1.30, 1.04, 0.78).
const TUNG_MAIN_YS = [
 1.48, 1.462, 1.43, 1.37, 1.316, 1.30, 1.284, 1.22, 1.13, 1.056, 1.04, 1.024, 0.96, 0.87, 0.796,
 0.78, 0.764, 0.70, 0.63, 0.56,
] as const

const TUNG_COLS = TUNG_XS.length
const TUNG_ROWS = TUNG_MAIN_YS.length + 2
const TUNG_GRID = TUNG_COLS * TUNG_ROWS

function tungBottomY(x: number): number {
 if (x <= 0.10) return THREE.MathUtils.lerp(0.54, 0.48, (x - 0.035) / (0.10 - 0.035))
 if (x <= 0.17) return THREE.MathUtils.lerp(0.48, 0.54, (x - 0.10) / (0.17 - 0.10))
 if (x <= 0.235) return THREE.MathUtils.lerp(0.54, 0.48, (x - 0.17) / (0.235 - 0.17))
 return THREE.MathUtils.lerp(0.48, 0.54, (x - 0.235) / (0.30 - 0.235))
}

function smoothFoldBend(y: number, creaseY: number, eps = 0.012): number {
 const d = creaseY - y
 const dTop = creaseY - TUNG_Y_TOP
 return 0.5 * (d + Math.sqrt(d * d + eps * eps)) - 0.5 * (dTop + Math.sqrt(dTop * dTop + eps * eps))
}

function evalTungOffset(x: number, y: number, airX: number, airZ: number): [number, number, number] {
 const u = (x - TUNG_X_MIN) / TUNG_W
 const ux = u - 0.5
 const v = THREE.MathUtils.clamp((TUNG_Y_TOP - y) / TUNG_H, 0, 1)

 // Alternating quarter-fold accordion memory along y = 1.30 (+), 1.04 (-), 0.78 (+).
 const foldZ =
  0.088 * (TUNG_Y_TOP - y)
  - 0.176 * smoothFoldBend(y, 1.30)
  + 0.184 * smoothFoldBend(y, 1.04)
  - 0.162 * smoothFoldBend(y, 0.78)

 // Gentle stiff-paper hanging drape, cross-sheet camber, asymmetric breeze twist, and swallowtail curl.
 const v2 = v * v
 const breezeZ = 0.024 * Math.sin(Math.PI * v * 0.88) + 0.016 * v2
 const cupZ = -0.008 * Math.sin(Math.PI * v) * (4 * ux * ux)
 const twistZ = 0.030 * Math.pow(v, 1.7) * ux
 const tailPhase = Math.max(0, (v - 0.80) / 0.20)
 const tailCurlZ = 0.012 * tailPhase * tailPhase * (0.65 + 0.35 * Math.cos(Math.PI * (u * 4 - 1)))
 const tiePinchZ = -0.0028 * Math.exp(-v * 28) * (
  Math.exp(-Math.pow((x - 0.09) / 0.022, 2)) + Math.exp(-Math.pow((x - 0.24) / 0.022, 2))
 )

 const xOut = x + (0.024 * Math.pow(v, 1.85) + airX * v2)
 const yOut = y + 0.008 * v2
 const zOut = foldZ + breezeZ + cupZ + twistZ + tailCurlZ + tiePinchZ + airZ * v2
 return [xOut, yOut, zOut]
}

/**
 * Builds a closed thin double-sided paper banner with exact serrated twin swallowtails,
 * smooth quarter-fold creases, warm cut-paper perimeter edges, and deterministic pose lag.
 */
function createTungPaperGeometry(): {
 geometry: THREE.BufferGeometry
 update: (airX: number, airZ: number) => void
} {
 const baseXs = new Float32Array(TUNG_GRID)
 const baseYs = new Float32Array(TUNG_GRID)
 const uvs: number[] = []
 const colors: number[] = []
 const indices: number[] = []
 const edgeSources: number[] = []

 for (let iy = 0; iy < TUNG_ROWS; iy++) {
  for (let ix = 0; ix < TUNG_COLS; ix++) {
   const x = TUNG_XS[ix]!
   const yBot = tungBottomY(x)
   const y = iy < TUNG_MAIN_YS.length
    ? TUNG_MAIN_YS[iy]!
    : iy === TUNG_MAIN_YS.length
     ? THREE.MathUtils.lerp(0.56, yBot, 0.5)
     : yBot
   const k = iy * TUNG_COLS + ix
   baseXs[k] = x
   baseYs[k] = y
  }
 }

 // Front face (side = 0) and back face (side = 1).
 for (let side = 0; side < 2; side++) {
  const sideTone = side === 0 ? 1.0 : 0.94
  for (let iy = 0; iy < TUNG_ROWS; iy++) {
   for (let ix = 0; ix < TUNG_COLS; ix++) {
    const k = iy * TUNG_COLS + ix
    const x = baseXs[k]!
    const y = baseYs[k]!
    const u = (x - TUNG_X_MIN) / TUNG_W
    const v = (TUNG_Y_TOP - y) / TUNG_H
    uvs.push(u, 1 - v)

    // Subtle geometric crease shading along the three quarter-folds and crossbar contact band.
    const ridge130 = Math.exp(-Math.pow((y - 1.30) / 0.015, 2))
    const valley104 = Math.exp(-Math.pow((y - 1.04) / 0.016, 2))
    const ridge078 = Math.exp(-Math.pow((y - 0.78) / 0.015, 2))
    const topBarShade = Math.exp(-Math.pow((TUNG_Y_TOP - y) / 0.014, 2)) * 0.045
    const creaseTint = (ridge130 + ridge078) * 0.022 - valley104 * 0.052 - topBarShade
    const s = (1 + creaseTint) * sideTone
    colors.push(s, s * 0.99, s * 0.975)
   }
  }
 }

 const quad = (a: number, b: number, c: number, d: number) => indices.push(a, b, c, a, c, d)
 for (let iy = 0; iy < TUNG_ROWS - 1; iy++) {
  for (let ix = 0; ix < TUNG_COLS - 1; ix++) {
   const a = iy * TUNG_COLS + ix
   quad(a, a + TUNG_COLS, a + TUNG_COLS + 1, a + 1)
   quad(TUNG_GRID + a, TUNG_GRID + a + 1, TUNG_GRID + a + TUNG_COLS + 1, TUNG_GRID + a + TUNG_COLS)
  }
 }

 // Closed cut-paper perimeter rim around top, right, serrated swallowtail bottom, and left edges.
 const perimeter: number[] = []
 for (let ix = 0; ix < TUNG_COLS; ix++) perimeter.push(ix)
 for (let iy = 1; iy < TUNG_ROWS; iy++) perimeter.push(iy * TUNG_COLS + (TUNG_COLS - 1))
 for (let ix = TUNG_COLS - 2; ix >= 0; ix--) perimeter.push((TUNG_ROWS - 1) * TUNG_COLS + ix)
 for (let iy = TUNG_ROWS - 2; iy >= 0; iy--) perimeter.push(iy * TUNG_COLS)

 const edgeStart = TUNG_GRID * 2
 for (let i = 0; i < perimeter.length; i++) {
  const k = perimeter[i]!
  edgeSources.push(k)
  const u = (baseXs[k]! - TUNG_X_MIN) / TUNG_W
  const v = (TUNG_Y_TOP - baseYs[k]!) / TUNG_H
  uvs.push(u, 1 - v, u, 1 - v)
  // Warm pale cut-paper core along the thin perimeter rim.
  colors.push(1.06, 1.03, 0.96, 1.06, 1.03, 0.96)
 }
 for (let i = 0; i < perimeter.length - 1; i++) {
  const f0 = edgeStart + i * 2
  const b0 = f0 + 1
  const f1 = f0 + 2
  const b1 = f0 + 3
  quad(f0, f1, b1, b0)
 }

 const totalVerts = edgeStart + edgeSources.length * 2
 const positions = new Float32Array(totalVerts * 3)
 const geometry = new THREE.BufferGeometry()
 geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
 geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
 geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
 geometry.setIndex(indices)

 const mid = new Float32Array(TUNG_GRID * 3)
 const nrm = new Float32Array(TUNG_GRID * 3)

 const update = (airX: number, airZ: number) => {
  for (let k = 0; k < TUNG_GRID; k++) {
   const [px, py, pz] = evalTungOffset(baseXs[k]!, baseYs[k]!, airX, airZ)
   mid[k * 3] = px
   mid[k * 3 + 1] = py
   mid[k * 3 + 2] = pz
  }

  for (let iy = 0; iy < TUNG_ROWS; iy++) {
   for (let ix = 0; ix < TUNG_COLS; ix++) {
    const k = iy * TUNG_COLS + ix
    const kL = iy * TUNG_COLS + Math.max(0, ix - 1)
    const kR = iy * TUNG_COLS + Math.min(TUNG_COLS - 1, ix + 1)
    const kU = Math.max(0, iy - 1) * TUNG_COLS + ix
    const kD = Math.min(TUNG_ROWS - 1, iy + 1) * TUNG_COLS + ix

    const tx = mid[kR * 3]! - mid[kL * 3]!
    const ty = mid[kR * 3 + 1]! - mid[kL * 3 + 1]!
    const tz = mid[kR * 3 + 2]! - mid[kL * 3 + 2]!
    const bx = mid[kU * 3]! - mid[kD * 3]!
    const by = mid[kU * 3 + 1]! - mid[kD * 3 + 1]!
    const bz = mid[kU * 3 + 2]! - mid[kD * 3 + 2]!

    let nx = ty * bz - tz * by
    let ny = tz * bx - tx * bz
    let nz = tx * by - ty * bx
    const len = Math.hypot(nx, ny, nz) || 1
    nx /= len; ny /= len; nz /= len
    if (nz < 0) { nx = -nx; ny = -ny; nz = -nz }
    nrm[k * 3] = nx
    nrm[k * 3 + 1] = ny
    nrm[k * 3 + 2] = nz
   }
  }

  for (let k = 0; k < TUNG_GRID; k++) {
   const px = mid[k * 3]!, py = mid[k * 3 + 1]!, pz = mid[k * 3 + 2]!
   const nx = nrm[k * 3]!, ny = nrm[k * 3 + 1]!, nz = nrm[k * 3 + 2]!
   const fOff = k * 3
   const bOff = (TUNG_GRID + k) * 3
   positions[fOff] = px + nx * TUNG_HALF_T
   positions[fOff + 1] = py + ny * TUNG_HALF_T
   positions[fOff + 2] = pz + nz * TUNG_HALF_T
   positions[bOff] = px - nx * TUNG_HALF_T
   positions[bOff + 1] = py - ny * TUNG_HALF_T
   positions[bOff + 2] = pz - nz * TUNG_HALF_T
  }

  for (let i = 0; i < edgeSources.length; i++) {
   const k = edgeSources[i]!
   const fSrc = k * 3
   const bSrc = (TUNG_GRID + k) * 3
   const fDst = (edgeStart + i * 2) * 3
   const bDst = fDst + 3
   positions[fDst] = positions[fSrc]!
   positions[fDst + 1] = positions[fSrc + 1]!
   positions[fDst + 2] = positions[fSrc + 2]!
   positions[bDst] = positions[bSrc]!
   positions[bDst + 1] = positions[bSrc + 1]!
   positions[bDst + 2] = positions[bSrc + 2]!
  }

  geometry.attributes.position!.needsUpdate = true
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
 }

 update(0, 0)
 return { geometry, update }
}

/** Deterministic fine sand-grain DataTexture (never misclassified as stone/ceramic). */
const cachedSandPixels = new Map<string, { color: Uint8Array; bump: Uint8Array; rough: Uint8Array; size: number }>()
function sandHash(ix: number, iy: number, seed: number): number {
 let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0
 h = Math.imul(h ^ (h >>> 13), 1274126177)
 return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}
function createSandMaterial(baseHex: number, repeat: number, seed: number): THREE.MeshStandardMaterial {
 const size = 128
 const key = `lanna-sand-${baseHex.toString(16)}-${seed}`
 let cached = cachedSandPixels.get(key)
 if (!cached) {
  const base = new THREE.Color(baseHex)
  const br = base.r * 255, bg = base.g * 255, bb = base.b * 255
  const color = new Uint8Array(size * size * 4)
  const bump = new Uint8Array(size * size * 4)
  const rough = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
   for (let x = 0; x < size; x++) {
    const fine = sandHash(x, y, seed) - 0.5
    const med = sandHash(x >> 1, y >> 1, seed + 37) - 0.5
    const ripple = Math.sin((y / size) * Math.PI * 12 + Math.sin((x / size) * Math.PI * 4) * 0.65) * 0.5
    const delta = fine * 18 + med * 12 + ripple * 5
    const idx = (y * size + x) * 4
    color[idx] = THREE.MathUtils.clamp(Math.round(br + delta * 0.95), 0, 242)
    color[idx + 1] = THREE.MathUtils.clamp(Math.round(bg + delta * 0.88), 0, 224)
    color[idx + 2] = THREE.MathUtils.clamp(Math.round(bb + delta * 0.72), 0, 184)
    color[idx + 3] = 255
    const h = THREE.MathUtils.clamp(Math.round(128 + fine * 58 + med * 34 + ripple * 16), 36, 224)
    bump[idx] = bump[idx + 1] = bump[idx + 2] = h
    bump[idx + 3] = 255
    const rv = THREE.MathUtils.clamp(Math.round(238 - fine * 18 + med * 12), 214, 255)
    rough[idx] = rough[idx + 1] = rough[idx + 2] = rv
    rough[idx + 3] = 255
   }
  }
  cached = { color, bump, rough, size }
  cachedSandPixels.set(key, cached)
 }
 const makeTex = (src: Uint8Array, cs: THREE.ColorSpace) => {
  const tex = new THREE.DataTexture(new Uint8Array(src), cached!.size, cached!.size)
  tex.colorSpace = cs
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeat, repeat)
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
 }
 const map = makeTex(cached.color, THREE.SRGBColorSpace)
 const bumpMap = makeTex(cached.bump, THREE.NoColorSpace)
 const roughnessMap = makeTex(cached.rough, THREE.NoColorSpace)
 const material = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  map,
  bumpMap,
  bumpScale: 0.0045,
  roughnessMap,
  roughness: 0.95,
  metalness: 0,
  vertexColors: true,
 })
 let freed = false
 material.addEventListener('dispose', () => {
  if (freed) return
  freed = true
  map.dispose()
  bumpMap.dispose()
  roughnessMap.dispose()
 })
 return material
}

function applySandVertexShading(geometry: THREE.BufferGeometry, mode: 'bed' | 'tower') {
 const pos = geometry.getAttribute('position') as THREE.BufferAttribute
 const colors = new Float32Array(pos.count * 3)
 for (let i = 0; i < pos.count; i++) {
  const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
  const r = Math.hypot(x, z)
  let shade = 1
  if (mode === 'bed') {
   const edgeAO = 1 - 0.065 * THREE.MathUtils.smoothstep(r, 1.16, 1.43)
   const ripple = 0.022 * Math.sin(r * 14 + Math.atan2(z, x) * 3)
   shade = THREE.MathUtils.clamp(edgeAO + ripple, 0.88, 1.03)
  } else {
   const stepLift = 0.94 + 0.08 * THREE.MathUtils.clamp(y / 1.06, 0, 1)
   const grain = 0.018 * Math.sin(y * 32 + Math.atan2(z, x) * 5)
   shade = THREE.MathUtils.clamp(stepLift + grain, 0.90, 1.04)
  }
  colors[i * 3] = shade
  colors[i * 3 + 1] = shade * 0.992
  colors[i * 3 + 2] = shade * 0.978
 }
 geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
}

/** Original sand-pagoda diorama; one prepared paper-and-bamboo tung is planted beside it. */
export function createLannaSandPagodaModel() {
 const root=new THREE.Group();root.name='lanna-sand-pagoda-root'
 const subject=new THREE.Group();subject.name='lanna-sand-pagoda-subject';root.add(subject)
 const flag=new THREE.Group();flag.name='lanna-flag';subject.add(flag)
 const mat=(color:number)=>new THREE.MeshStandardMaterial({color,roughness:.93})
 const sand=createSandMaterial(0xd7b67d,4.5,113),sandLight=createSandMaterial(0xe4c995,3.2,241),bamboo=mat(0xa5864e),node=mat(0xc4aa6b),wood=mat(0x90714f),curbStone=mat(0xc2b69c)
 const paper=createRitualMaterial({
  color:0xf0bf83,
  roughness:.94,
  vertexColors:true,
 },{
  kind:'paper',
  strength:.34,
  fiber:'paper',
  paper:{
   layout:'sheet',
   aspect:TUNG_W/TUNG_H,
   grainScale:7.2,
   grain:.72,
   fibers:.26,
   edge:.40,
   highlightGuard:.68,
  },
 })
 const holeMat=mat(0x4e3b28)
 const binding=mat(0xc4aa6b) // Separate fixing cord from the equally coloured bamboo nodes.
 applyCraftSurface(wood,{kind:'wood',strength:.4,axis:'y'})
 applyCraftSurface(curbStone,{kind:'stone',strength:.38})
 for(const cane of[bamboo,node])applyCraftSurface(cane,{kind:'bamboo',strength:.35,axis:'y'})
 applyCraftSurface(binding,{kind:'cord',strength:.3})
 let serial=0
 const mesh=(g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D,name?:string)=>{const o=new THREE.Mesh(g,m);o.name=name??`lanna-detail-${serial++}`;o.castShadow=o.receiveShadow=true;parent.add(o);return o}
 const bedGeo=new THREE.CylinderGeometry(1.38,1.43,.08,64);applySandVertexShading(bedGeo,'bed')
 const ground=mesh(bedGeo,sand,root,'lanna-sand-bed');ground.position.y=-.04
 // Low chamfered courtyard stone curb ring frames the widened sand bed cleanly at -0.0625..-0.08.
 const curbProfile=[
  new THREE.Vector2(1.37,-.08),
  new THREE.Vector2(1.49,-.08),
  new THREE.Vector2(1.49,.006),
  new THREE.Vector2(1.474,.022),
  new THREE.Vector2(1.388,.022),
  new THREE.Vector2(1.372,.006),
  new THREE.Vector2(1.37,-.08),
 ]
 const curbGeo=new THREE.LatheGeometry(curbProfile,64);curbGeo.computeVertexNormals()
 mesh(curbGeo,curbStone,root,'lanna-sand-curb')
 const tower=new THREE.Group();tower.name='lanna-tower';tower.position.set(-.16,0,-.18);subject.add(tower)
 // A continuous, capped lathe surface with stepped sand mouldings, not stacked floating solids.
 const profile=[[0,0],[.49,0],[.49,.09],[.44,.11],[.44,.17],[.39,.19],[.39,.25],[.34,.27],[.31,.34],[.30,.46],[.27,.57],[.22,.68],[.16,.76],[.12,.78],[.12,.82],[.09,.84],[.065,.91],[.045,.98],[0,1.06]]
 const g=new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r!,y!)),48);g.computeVertexNormals();applySandVertexShading(g,'tower');mesh(g,sandLight,tower,'lanna-sand-tower')
 const holderBaseGeo=new THREE.LatheGeometry([
  new THREE.Vector2(0,0),new THREE.Vector2(.148,0),new THREE.Vector2(.15,.006),
  new THREE.Vector2(.136,.032),new THREE.Vector2(.126,.04),new THREE.Vector2(0,.04),
 ],28);holderBaseGeo.computeVertexNormals()
 const base=mesh(holderBaseGeo,wood,subject,'lanna-holder-base');base.position.set(-1.02,0,.58)
 const holder=mesh(new THREE.TorusGeometry(.055,.018,8,24),wood,subject,'lanna-holder-ring');holder.rotation.x=Math.PI/2;holder.position.set(-1.02,.095,.58)
 for(const dx of[-.055,.055]){const foot=mesh(new THREE.CylinderGeometry(.012,.014,.06,8),wood,subject);foot.position.set(-1.02+dx,.06,.58)}
 const pole=mesh(new THREE.CylinderGeometry(.016,.019,1.52,12),bamboo,flag,'lanna-pole');pole.position.y=.76
 for(const y of[.22,.57,.92,1.27]){const ring=mesh(new THREE.TorusGeometry(.017,.003,6,12),node,flag);ring.rotation.x=Math.PI/2;ring.position.y=y}
 const crossbar=mesh(new THREE.CylinderGeometry(.009,.009,.34,8),bamboo,flag,'lanna-crossbar');crossbar.rotation.z=Math.PI/2;crossbar.position.set(.16,1.48,0)
 // Unwritten pale-orange twin-swallowtail paper banner with geometric quarter-fold creases and hanging drape.
 const tungPaper=createTungPaperGeometry()
 const tung=mesh(tungPaper.geometry,paper,flag,'lanna-tung');tung.position.z=.009
 for(const [i,x] of[.09,.24].entries()){
  const tie=mesh(new THREE.TorusGeometry(.019,.0025,6,16),binding,flag,`lanna-binding-${i}`);tie.rotation.y=Math.PI/2;tie.position.set(x,1.477,.006)
  // Top punch holes directly aligned with each binding loop (front and back).
  const [hx,hy,hz]=evalTungOffset(x,1.462,0,0)
  for(const side of[1,-1]){
   const hole=new THREE.Mesh(new THREE.CircleGeometry(.0052,12),holeMat)
   hole.name=`lanna-tung-hole-${i}-${side>0?'f':'b'}`
   hole.position.set(hx,hy,hz+side*(TUNG_HALF_T+.0004))
   if(side<0)hole.rotation.y=Math.PI
   hole.userData.toonSurface={outline:false}
   tung.add(hole)
  }
 }
 // Small irregular grains stay on the sand surface, away from the holder and planted pole.
 const grainMat=mat(0xbfa274)
 for(let i=0;i<25;i++){const a=i*2.39996,r=.77+.16*Math.sin(i*4.1),x=Math.cos(a)*r,z=Math.sin(a)*r;if(Math.hypot(x-.68,z-.58)<.16||x<-.8)continue;const grain=mesh(new THREE.DodecahedronGeometry(.012+(i%3)*.004,0),grainMat,root);grain.position.set(x,.007,z);grain.scale.y=.4}
 let lastAirX=0,lastAirZ=0
 const pose=(step:number,n:number)=>{
  const t=Number.isFinite(n)?THREE.MathUtils.clamp(n,0,1):0
  const air=step<3?Math.sin(Math.PI*t):0
  const airX=step===1?-0.026*air:0
  const airZ=step===0?0.016*air:step===1?0.020*air:step===2?-0.014*air:0
  if(airX!==lastAirX||airZ!==lastAirZ){lastAirX=airX;lastAirZ=airZ;tungPaper.update(airX,airZ)}
  flag.rotation.set(0,0,0)
  if(step<=0)flag.position.set(-1.02,t===1?.44:THREE.MathUtils.lerp(.04,.44,t),.58)
  else if(step===1)flag.position.set(t===1?.68:THREE.MathUtils.lerp(-1.02,.68,t),.44,.58)
  else flag.position.set(.68,step>=3||t===1?-.045:THREE.MathUtils.lerp(.44,-.045,t),.58)
  root.updateMatrixWorld(true)
 }
 pose(0,0)
 return{root,subject,flag,targets:[tung,tung,tung],roots:[flag,flag,flag],anchors:[[.17,.98,.02],[.17,.98,.02],[.17,.98,.02]] as [number,number,number][],pose}
}
