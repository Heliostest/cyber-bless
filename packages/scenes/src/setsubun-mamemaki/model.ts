import { getEnvironmentSurfaceY } from '@wbr/scene-runtime'
import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'

const PAPER_W = 1.01
const PAPER_H = 1.99
const PAPER_Z_BACK = -0.028
const PAPER_Z_FRONT = -0.016

function hash2(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = x - ix, fy = y - iy
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy)
  const a = hash2(ix, iy, seed)
  const b = hash2(ix + 1, iy, seed)
  const c = hash2(ix, iy + 1, seed)
  const d = hash2(ix + 1, iy + 1, seed)
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, ux), THREE.MathUtils.lerp(c, d, ux), uy)
}

function fbm(x: number, y: number, seed: number): number {
  return valueNoise(x, y, seed) * 0.56
    + valueNoise(x * 2.07 + 3.1, y * 2.03 + 1.7, seed + 17) * 0.29
    + valueNoise(x * 4.19 + 7.4, y * 4.11 + 5.2, seed + 37) * 0.15
}

/**
 * Deterministic 256x256 backlit shoji-paper transmittance DataTexture (WebGL + jsdom safe).
 * Attenuates light cleanly near the wooden kumiko rails/mullions where pasted paper overlaps wood,
 * and adds organic mulberry pulp mottling, laid bamboo-screen lines, and fine translucent fibers.
 */
function createShojiBacklightMap(size = 256): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4)
  // Precompute sparse deterministic fine kozo fiber wisps across the sheet.
  const fiberCount = 150
  const fibers: { x0: number; y0: number; dx: number; dy: number; curve: number; width: number; dark: number }[] = []
  for (let i = 0; i < fiberCount; i++) {
    const x0 = hash2(i, 1, 91)
    const y0 = hash2(i, 2, 91)
    const angle = (hash2(i, 3, 91) - 0.5) * Math.PI * 1.15
    const len = 0.018 + hash2(i, 4, 91) * 0.042
    fibers.push({
      x0,
      y0,
      dx: Math.cos(angle) * len,
      dy: Math.sin(angle) * len * 0.55,
      curve: (hash2(i, 5, 91) - 0.5) * 0.014,
      width: 0.0016 + hash2(i, 6, 91) * 0.0018,
      dark: 0.06 + hash2(i, 7, 91) * 0.08,
    })
  }
  const fiberMask = new Float32Array(size * size)
  for (const f of fibers) {
    const steps = 14
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      const bend = Math.sin(Math.PI * t) * f.curve
      const px = f.x0 + f.dx * t - f.dy * bend * 12
      const py = f.y0 + f.dy * t + f.dx * bend * 12
      const cx = Math.round(px * (size - 1))
      const cy = Math.round(py * (size - 1))
      const rad = Math.max(1, Math.ceil(f.width * size))
      for (let oy = -rad; oy <= rad; oy++) {
        const yy = cy + oy
        if (yy < 0 || yy >= size) continue
        for (let ox = -rad; ox <= rad; ox++) {
          const xx = cx + ox
          if (xx < 0 || xx >= size) continue
          const d = Math.hypot(ox, oy) / (rad + 0.5)
          if (d < 1) {
            const w = (1 - d) * f.dark * Math.sin(Math.PI * t)
            const idx = yy * size + xx
            fiberMask[idx] = Math.min(0.24, fiberMask[idx]! + w)
          }
        }
      }
    }
  }

  // Exact kumiko wood rail/mullion coordinates mapped into sheet UV space (u: x in [-0.505,0.505], v: y in [0.055,2.045]).
  const vRails = [0.0025, 0.249, 0.500, 0.751, 0.9975] as const
  const vRailHalf = 0.016
  const uCenterHalf = 0.022

  for (let iy = 0; iy < size; iy++) {
    const v = iy / (size - 1)
    let dv = 1
    for (const vr of vRails) {
      dv = Math.min(dv, Math.max(0, Math.abs(v - vr) - vRailHalf))
    }
    const vClear = THREE.MathUtils.smoothstep(dv, 0.0, 0.045)
    // Gentle sky-to-courtyard backlight gradient (upper panes catch brighter morning sky).
    const skyGrad = THREE.MathUtils.lerp(0.84, 1.05, Math.pow(v, 0.85))
    // Subtle horizontal laid-screen texture (sugeta bamboo ribs).
    const laid = Math.sin(v * Math.PI * 2 * 64) * 0.022

    for (let ix = 0; ix < size; ix++) {
      const u = ix / (size - 1)
      const duLeft = Math.max(0, u - 0.005)
      const duRight = Math.max(0, 0.995 - u)
      const duCenter = Math.max(0, Math.abs(u - 0.5) - uCenterHalf)
      const du = Math.min(duLeft, duRight, duCenter)
      const uClear = THREE.MathUtils.smoothstep(du, 0.0, 0.075)

      const paneGlow = 0.36 + 0.64 * (uClear * vClear)
      const pulp = (fbm(u * 5.2, v * 9.8, 13) - 0.5) * 0.20
      const sunDiag = 1 + (0.5 - u) * 0.06 + (v - 0.5) * 0.04
      const kozoDark = fiberMask[iy * size + ix]!

      const trans = THREE.MathUtils.clamp(paneGlow * skyGrad * sunDiag + pulp + laid - kozoDark, 0.22, 1.0)
      // Glowing pane centers read warm sunlit milk-ivory; mullion borders & denser pulp warm toward honey-cream.
      const r = THREE.MathUtils.clamp(Math.round((0.80 + 0.20 * trans) * trans * 255), 0, 255)
      const g = THREE.MathUtils.clamp(Math.round((0.70 + 0.24 * trans) * trans * 255), 0, 255)
      const b = THREE.MathUtils.clamp(Math.round((0.50 + 0.29 * trans) * trans * 255), 0, 255)
      const p = (iy * size + ix) * 4
      data[p] = r
      data[p + 1] = g
      data[p + 2] = b
      data[p + 3] = 255
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  tex.magFilter = tex.minFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}

/**
 * Builds a closed thin recessed shoji-paper sheet geometry (origin at panel center [0, 1.05, 0])
 * tucked onto the outer side of the kumiko lattice (z in [-0.028, -0.016]) so the wooden frame
 * and mullions stand cleanly proud in 3D relief while each pane carries subtle taut paper tension
 * and soft mullion-border ambient occlusion.
 */
function createShojiPaperGeometry(): THREE.BufferGeometry {
  const cols = 20, rows = 32
  const stride = cols + 1
  const gridVerts = (cols + 1) * (rows + 1)
  const positions: number[] = []
  const uvs: number[] = []
  const colors: number[] = []
  const indices: number[] = []

  const frontPts: [number, number, number][] = new Array(gridVerts)
  const backPts: [number, number, number][] = new Array(gridVerts)
  const shades: number[] = new Array(gridVerts)

  const railYs = [-0.995, -0.50, 0.0, 0.50, 0.995] as const

  for (let iy = 0; iy <= rows; iy++) {
    const v = iy / rows
    const y = (v - 0.5) * PAPER_H
    let distY = 1
    for (const ry of railYs) distY = Math.min(distY, Math.abs(y - ry))
    const cellY = THREE.MathUtils.smoothstep(distY, 0.02, 0.14)

    for (let ix = 0; ix <= cols; ix++) {
      const u = ix / cols
      const x = (u - 0.5) * PAPER_W
      const distX = Math.min(Math.abs(x + 0.50), Math.abs(x), Math.abs(x - 0.50))
      const cellX = THREE.MathUtils.smoothstep(distX, 0.015, 0.13)
      const cellCenter = cellX * cellY

      // Very gentle taut paper breathing sag inside each pane (flat/taut along every wooden bar).
      const tension = 0.0022 * cellCenter * (0.7 + 0.3 * Math.sin(x * 7.5 + y * 3.1))
      const ao = 0.88 + 0.12 * (0.35 + 0.65 * cellCenter)

      const idx = iy * stride + ix
      frontPts[idx] = [x, y, PAPER_Z_FRONT + tension]
      backPts[idx] = [x, y, PAPER_Z_BACK + tension * 0.6]
      shades[idx] = ao
    }
  }

  // Front face (+Z, facing indoor camera).
  for (let iy = 0; iy <= rows; iy++) {
    const v = iy / rows
    for (let ix = 0; ix <= cols; ix++) {
      const u = ix / cols
      const idx = iy * stride + ix
      const p = frontPts[idx]!
      const s = shades[idx]!
      positions.push(p[0], p[1], p[2])
      uvs.push(u, v)
      colors.push(s, s, s)
    }
  }
  for (let iy = 0; iy < rows; iy++) {
    for (let ix = 0; ix < cols; ix++) {
      const a = iy * stride + ix
      const b = a + 1
      const c = a + stride + 1
      const d = a + stride
      indices.push(a, b, c, a, c, d)
    }
  }

  // Back face (-Z, facing garden outside).
  const backBase = gridVerts
  for (let iy = 0; iy <= rows; iy++) {
    const v = iy / rows
    for (let ix = 0; ix <= cols; ix++) {
      const u = ix / cols
      const idx = iy * stride + ix
      const p = backPts[idx]!
      const s = shades[idx]! * 0.96
      positions.push(p[0], p[1], p[2])
      uvs.push(u, v)
      colors.push(s, s, s)
    }
  }
  for (let iy = 0; iy < rows; iy++) {
    for (let ix = 0; ix < cols; ix++) {
      const a = backBase + iy * stride + ix
      const b = a + 1
      const c = a + stride + 1
      const d = a + stride
      indices.push(a, c, b, a, d, c)
    }
  }

  // Perimeter closure strips (CCW viewed from +Z: bottom -> right -> top -> left).
  const ring: number[] = []
  for (let ix = 0; ix < cols; ix++) ring.push(ix)
  for (let iy = 0; iy < rows; iy++) ring.push(iy * stride + cols)
  for (let ix = cols; ix > 0; ix--) ring.push(rows * stride + ix)
  for (let iy = rows; iy > 0; iy--) ring.push(iy * stride)

  for (let k = 0; k < ring.length; k++) {
    const i0 = ring[k]!
    const i1 = ring[(k + 1) % ring.length]!
    const f0 = frontPts[i0]!, b0 = backPts[i0]!, b1 = backPts[i1]!, f1 = frontPts[i1]!
    const base = positions.length / 3
    positions.push(
      f0[0], f0[1], f0[2],
      b0[0], b0[1], b0[2],
      b1[0], b1[1], b1[2],
      f1[0], f1[1], f1[2],
    )
    uvs.push(0.02, 0.5, 0.02, 0.5, 0.04, 0.5, 0.04, 0.5)
    colors.push(0.9, 0.9, 0.9, 0.86, 0.86, 0.86, 0.86, 0.86, 0.86, 0.9, 0.9, 0.9)
    indices.push(base, base + 1, base + 3, base + 1, base + 2, base + 3)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/** A cutaway home and two handfuls of roasted beans; proportions and paths are illustrative. */
export function createSetsubunModel() {
  const root=new THREE.Group();root.name='beans-root'
  const subject=new THREE.Group();subject.name='beans-subject';root.add(subject)
  const mat=(color:number,roughness=.85)=>new THREE.MeshStandardMaterial({color,roughness})
  const shojiBacklightMap = createShojiBacklightMap(256)
  const wood=mat(0xae7b4c),lightWood=mat(0xd7ad73)
  const paper = createRitualMaterial({
    color: 0xf8ecd0,
    emissive: 0xffdea0,
    emissiveMap: shojiBacklightMap,
    emissiveIntensity: 0.42,
    roughness: 0.96,
    vertexColors: true,
  }, {
    kind: 'paper',
    strength: 0.28,
    fiber: 'paper',
    paper: {
      layout: 'sheet',
      aspect: 0.52,
      grainScale: 2.5,
      grain: 0.98,
      fibers: 0.26,
      edge: 0.36,
      highlightGuard: 0.96,
    },
  })
  // Release the procedural backlight texture exactly once when disposeTree disposes `paper`.
  const releaseBacklight = () => {
    paper.removeEventListener('dispose', releaseBacklight)
    shojiBacklightMap.dispose()
  }
  paper.addEventListener('dispose', releaseBacklight)

  const stone=mat(0xc5c6ab),floor=mat(0xc99560),beanMat=mat(0xd9b667,.7),hilumMat=mat(0x94714b)
  const woodY=mat(0xae7b4c),woodZ=mat(0xae7b4c),lightWoodY=mat(0xd7ad73),lightWoodZ=mat(0xd7ad73)
  applyCraftSurface(wood, { kind: 'wood', axis: 'x', strength: .4 })
  applyCraftSurface(woodY, { kind: 'wood', axis: 'y', strength: .4 })
  applyCraftSurface(woodZ, { kind: 'wood', axis: 'z', strength: .4 })
  applyCraftSurface(lightWood, { kind: 'wood', axis: 'x', strength: .4 })
  applyCraftSurface(lightWoodY, { kind: 'wood', axis: 'y', strength: .4 })
  applyCraftSurface(lightWoodZ, { kind: 'wood', axis: 'z', strength: .4 })
  applyCraftSurface(floor, { kind: 'wood', axis: 'z', strength: .4 })
  applyCraftSurface(stone, { kind: 'stone', strength: .4 })

  const mesh=(g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D,name:string)=>{const o=new THREE.Mesh(g,m);o.name=name;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
  const box=(name:string,size:[number,number,number],p:[number,number,number],m:THREE.Material,parent:THREE.Object3D=subject)=>{const o=mesh(new THREE.BoxGeometry(...size),m,parent,name);o.position.set(...p);return o}
  const rbox=(name:string,size:[number,number,number],p:[number,number,number],m:THREE.Material,parent:THREE.Object3D=subject,radius=.014)=>{const o=mesh(new RoundedBoxGeometry(size[0],size[1],size[2],2,Math.min(radius,size[0]/3,size[1]/3,size[2]/3)),m,parent,name);o.position.set(...p);return o}
  const inside=rbox('beans-inside-floor',[3,.16,2.5],[0,.015,.70],floor,subject,.016)
  // Ground the carved stone threshold directly into the courtyard floor; scattered outdoor beans land on the courtyard path itself.
  const outside=rbox('beans-threshold',[3,.16,.35],[0,.015,-.725],stone,subject,.016)
  // Thin seams sit in the floor surface; they do not add a raised support plane.
  for(let i=0;i<7;i++)box('beans-floor-seam-'+i,[.012,.004,2.48],[-1.28+i*.42,.093,.70],woodZ)
  for(const x of [-1.25,1.25])rbox('beans-post-'+x,[.12,2.2,.46],[x,1.195,-.61],woodY,subject,.014)
  rbox('beans-header',[2.62,.12,.46],[0,2.355,-.61],wood,subject,.014)
  const bottomTrack=rbox('beans-bottom-track',[2.62,.05,.42],[0,.12,-.61],lightWood,subject,.008)
  const topTrack=rbox('beans-top-track',[2.62,.05,.42],[0,2.27,-.61],lightWood,subject,.008)
  const shojiPaperGeo = createShojiPaperGeometry()
  const panel=(name:string,z:number)=>{
    const g=new THREE.Group();g.name=name+'-root';g.position.set(name==='beans-door'?-.57:.57,.145,z);subject.add(g)
    const face=mesh(shojiPaperGeo,paper,g,name)
    face.position.set(0,1.05,0)
    face.userData.toonSurface = { shading: 'smooth' }
    for(const x of [-.53,.53])rbox(name+'-edge-'+x,[.06,2.1,.09],[x,1.05,0],woodY,g,.008)
    for(const y of [.03,.55,1.05,1.55,2.07])rbox(name+'-rail-'+y,[1.12,.06,.09],[0,y,0],lightWood,g,.007)
    rbox(name+'-vertical',[.04,2.1,.09],[0,1.05,0],lightWoodY,g,.006)
    return {g,face}
  }
  panel('beans-fixed-panel',-.72)
  const door=panel('beans-door',-.50)
  // A solid bottom and four separate wooden walls make the masu visibly hollow.
  const cup=new THREE.Group();cup.name='beans-masu';cup.position.set(-.62,.095,.55);subject.add(cup)
  rbox('beans-masu-bottom',[.82,.04,.72],[0,.02,0],lightWood,cup,.006)
  for(const x of [-.39,.39])rbox('beans-masu-side-'+x,[.04,.25,.72],[x,.165,0],lightWoodZ,cup,.006)
  for(const z of [-.34,.34])rbox('beans-masu-end-'+z,[.74,.25,.04],[0,.165,z],wood,cup,.006)
  const groups:THREE.Group[]=[],bodies:THREE.Mesh[][]=[],targets:THREE.Mesh[]=[door.face]
  const starts=[new THREE.Vector3(-.79,.218,.55),new THREE.Vector3(-.45,.218,.55)]
  const outdoorSurfaceY=getEnvironmentSurfaceY('setsubun-mamemaki')
  const ends=[new THREE.Vector3(-.64,outdoorSurfaceY+.083,-1.60),new THREE.Vector3(-.12,.178,1.48)]
  for(const [batch,label] of ['out','in'].entries()){
    const g=new THREE.Group();g.name='beans-'+label+'-root';subject.add(g);groups.push(g);const list:THREE.Mesh[]=[]
    for(let i=0;i<3;i++){
      const b=mesh(new THREE.SphereGeometry(1,20,12),beanMat,g,i===1?'beans-'+label:'beans-'+label+'-'+i);b.scale.set(.105,.083,.085);list.push(b)
      const h=mesh(new THREE.SphereGeometry(1,12,8),hilumMat,b,'beans-'+label+'-hilum-'+i);h.scale.set(.32,.13,.12);h.position.set(0,.10,.94)
    }
    bodies.push(list);targets.push(list[1]!)
  }
  const pose=(step:number,amount:number)=>{
    const t=Number.isFinite(amount)?THREE.MathUtils.clamp(amount,0,1):0
    const opening=step>0?1:step===0?t:0;door.g.position.x=-.57+1.14*opening
    for(let batch=0;batch<2;batch++){
      const p=step>batch+1?1:step===batch+1?t:0,travel=THREE.MathUtils.smoothstep(p,.20,.86)
      const arc=p===0||p===1?0:.85*Math.sin(Math.PI*p)
      groups[batch]!.position.lerpVectors(starts[batch]!,ends[batch]!,travel)
      groups[batch]!.position.y=THREE.MathUtils.lerp(starts[batch]!.y,ends[batch]!.y,p)+arc
      bodies[batch]!.forEach((b,i)=>{
        b.position.set((i-1)*.32*travel,0,THREE.MathUtils.lerp((i-1)*.21,(i-1)*.18,travel))
      })
    }
    root.updateMatrixWorld(true)
  }
  pose(0,0)
  return {root,subject,targets,roots:[door.g,...groups],anchors:[[.20,-.12,.04],[0,.05,.04],[0,.05,.04]] as [number,number,number][],pose,bodies,inside,outside,bottomTrack,topTrack}
}
