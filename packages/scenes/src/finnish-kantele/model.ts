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

type KanteleWoodSpec = {
  key: string
  light: readonly [number, number, number]
  dark: readonly [number, number, number]
  warm: readonly [number, number, number]
  orientation: 'u' | 'v'
  rings: number
  arch: number
  wobble: number
  repeat: readonly [number, number]
  offset?: readonly [number, number]
  seed: number
}

const cachedKanteleWood = new Map<string, { color: Uint8Array; bump: Uint8Array; size: number }>()

/**
 * Deterministic stylized birch/spruce wood DataTexture (256x256, zero DOM/Canvas2D dependency):
 * calm warm earlywood/latewood sweeps calibrated against Komorebi sun blowout, soft cathedral
 * curves and delicate fibers for the carved kantele soundboard, hollow rim, pegs and bridge blocks.
 */
function createKanteleWoodTextures(spec: KanteleWoodSpec): { map: THREE.DataTexture; bump: THREE.DataTexture } {
  const size = 128
  let cached = cachedKanteleWood.get(spec.key)
  if (!cached) {
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2
    for (let y = 0; y < size; y++) {
      const v = y / size
      for (let x = 0; x < size; x++) {
        const u = x / size
        const along = spec.orientation === 'u' ? u : v
        const across = spec.orientation === 'u' ? v : u

        const wash = periodicWoodNoise(along * 2, across * 2, 2, 2, spec.seed + 13)
        const flow = (periodicWoodNoise(along * 2, across * 3, 2, 3, spec.seed + 29) - 0.5) * spec.wobble
        const fineWarp = (periodicWoodNoise(along * 4, across * 6, 4, 6, spec.seed + 43) - 0.5) * spec.wobble * 0.35
        const bow = Math.sin((along + spec.seed * 0.11) * tau) * spec.arch
        const ringPos = across * spec.rings + bow + flow + fineWarp
        const frac = ringPos - Math.floor(ringPos)
        const rampUp = THREE.MathUtils.smoothstep(frac, 0.06, 0.76)
        const rampDown = 1 - THREE.MathUtils.smoothstep(frac, 0.76, 0.99)
        const primaryRing = Math.pow(Math.min(rampUp, rampDown), 1.35)
        const softMod = 0.65 + 0.50 * periodicWoodNoise(along * 2, across * 4, 2, 4, spec.seed + 61)
        const fiber = periodicWoodNoise(along * 4, across * 36, 4, 36, spec.seed + 79) - 0.5

        const grainMix = THREE.MathUtils.clamp(primaryRing * 0.76 * softMod + fiber * 0.14, 0, 1)
        const warmMix = THREE.MathUtils.clamp(wash * 0.45, 0, 1)
        const baseR = THREE.MathUtils.lerp(spec.light[0], spec.warm[0], warmMix)
        const baseG = THREE.MathUtils.lerp(spec.light[1], spec.warm[1], warmMix)
        const baseB = THREE.MathUtils.lerp(spec.light[2], spec.warm[2], warmMix)

        const i = (y * size + x) * 4
        color[i] = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(baseR, spec.dark[0], grainMix)), 0, 255)
        color[i + 1] = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(baseG, spec.dark[1], grainMix)), 0, 255)
        color[i + 2] = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(baseB, spec.dark[2], grainMix)), 0, 255)
        color[i + 3] = 255

        const h = THREE.MathUtils.clamp(Math.round(128 - primaryRing * 20 * softMod + fiber * 14), 72, 188)
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
  return applyCraftSurface(mat, { kind: 'wood', axis: opts.axis, scale: opts.scale ?? .68, strength: opts.strength ?? .24 })
}

export function createKanteleModel() {
  const subject=new THREE.Group(),fixed=new THREE.Group();subject.name='kantele-subject';fixed.name='kantele-fixed';subject.add(fixed)
  // Warm carved birch rim & peg grips, calm sunlit spruce/birch soundboard (no vertexColors blowout),
  // deeper oiled alder/walnut pegs (vertical axis) and anchor bridge blocks (horizontal axis).
  const wood = createKanteleWoodMaterial(
    { key: 'kantele-birch-body', light: [184, 134, 82], dark: [142, 95, 52], warm: [198, 148, 94], orientation: 'u', rings: 5.0, arch: .26, wobble: .34, repeat: [.32, .56], offset: [.18, .22], seed: 19 },
    { axis: 'x', roughness: .72, clearcoat: .16, clearcoatRoughness: .42, bumpScale: .0024, scale: .68, strength: .26 },
  )
  const topWood = createKanteleWoodMaterial(
    { key: 'kantele-spruce-top', light: [204, 160, 102], dark: [168, 120, 68], warm: [215, 174, 116], orientation: 'u', rings: 5.6, arch: .30, wobble: .36, repeat: [.30, .58], offset: [.06, .14], seed: 37 },
    { axis: 'x', roughness: .74, clearcoat: .16, clearcoatRoughness: .44, bumpScale: .0022, scale: .64, strength: .24 },
  )
  const pegWood = createKanteleWoodMaterial(
    { key: 'kantele-peg-walnut', light: [136, 92, 60], dark: [104, 68, 42], warm: [148, 104, 70], orientation: 'v', rings: 3.6, arch: .14, wobble: .22, repeat: [1, 1], seed: 53 },
    { axis: 'y', roughness: .62, bumpScale: .0018, scale: .85, strength: .30 },
  )
  const bridgeWood = createKanteleWoodMaterial(
    { key: 'kantele-bridge-walnut', light: [136, 92, 60], dark: [104, 68, 42], warm: [148, 104, 70], orientation: 'u', rings: 3.0, arch: .12, wobble: .20, repeat: [1, 1], seed: 71 },
    { axis: 'x', roughness: .64, bumpScale: .0018, scale: .80, strength: .28 },
  )
  const steel=new THREE.MeshStandardMaterial({color:'#9daea9',metalness:.78,roughness:.38})
  const add=(name:string,g:THREE.BufferGeometry,mat:THREE.MeshStandardMaterial,parent:THREE.Object3D,x=0,y=0,z=0)=>{const mesh=new THREE.Mesh(g,mat);mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh}
  const outline=[[-1.72,-.82],[1.62,-.82],[1.62,.82],[-.70,.82]]
  const polygon=(scale=1)=>new THREE.Shape(outline.map(([x,z])=>new THREE.Vector2(x!*scale,-z!*scale)))
  const rimShape=polygon();rimShape.holes.push(new THREE.Path(outline.map(([x,z])=>new THREE.Vector2(x!*.90,-z!*.90)).reverse()))
  const slab=(shape:THREE.Shape,depth:number,bevel=false)=>{const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:bevel,bevelSegments:1,steps:1,bevelSize:.02,bevelThickness:.02,curveSegments:32});for(const key of ['position','normal']){const p=g.getAttribute(key);for(let i=0;i<p.count;i++){const y=p.getY(i),z=p.getZ(i);p.setY(i,z);p.setZ(i,-y)}}return g}
  const rim=add('kantele-hollow-rim',slab(rimShape,.24),wood,fixed)
  const topShape=polygon(),hole=new THREE.Path();hole.absarc(.20,-.635,.085,0,Math.PI*2,false);topShape.holes.push(hole)
  const top=add('kantele-soundboard',slab(topShape,.12,true),topWood,fixed,0,.24)
  const pegs:THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>[]=[],radius=.020
  for(let i=0;i<5;i++){const x=-1.45+i*.14,z=-.52+i*.26;pegs.push(add(`kantele-peg-${i}`,new THREE.CylinderGeometry(.075,.075,.28,16),pegWood,fixed,x,.50,z));add(`kantele-peg-grip-${i}`,new THREE.BoxGeometry(.20,.06,.09),wood,fixed,x,.65,z)}
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
