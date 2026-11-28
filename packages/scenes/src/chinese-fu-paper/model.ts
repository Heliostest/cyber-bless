import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { createProgressivePolygonsSlices, layoutTextPolygons } from '@wbr/scene-runtime/glyph-kit'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

const DIAMOND_HALF = 0.48
const SHEET_T = 0.0028
const GRID_SEG = 20
const GRID_SIDE = GRID_SEG + 1
const GRID_COUNT = GRID_SIDE * GRID_SIDE

/**
 * Evaluates the back-face Z of the thin red xuan-paper diamond (`|x| + |y| <= 0.48`).
 * - Exact `z = 0` at the lower pasted/resting tip `(0, -0.48)` keeps `paper.min.z` flush
 *   `0.001` in front of the wooden door leaf and seated cleanly inside the holder slot.
 * - Across the glyph center, subtle cross-fold memory and faint wood-plank seam ripples
 *   keep the front surface in `[0.0081, 0.0101]` for flush brush-ink relief.
 * - Top, left, and right diamond tips curl gently forward off the door to show thin
 *   paper edges and cast soft corner shadows on the wooden planks.
 */
function smoothCrease(t: number, eps = 0.022): number {
 return Math.sqrt(t * t + eps * eps) - eps
}

function evalFuSheetBackZ(x: number, y: number): number {
 // Gentle 4-quadrant unfolded quarter-fold relief (slight pyramid/ridge across x=0, y=0)
 // plus subtle wood-plank seam indentation at x = +-0.128, kept strictly within glyph Z budget.
 const base = 0.0063
 const vFold = -0.0022 * smoothCrease(x, 0.026)
 const hFold = -0.0020 * smoothCrease(y, 0.026)
 const seamRipple = -0.00075 * (
  Math.exp(-Math.pow((x - 0.128) / 0.028, 2)) + Math.exp(-Math.pow((x + 0.128) / 0.028, 2))
 ) * (1 - 0.35 * Math.min(1, (x * x + y * y) / 0.20))
 const wave = 0.00045 * Math.sin(x * 7.2 + 0.5) * Math.cos(y * 6.5 - 0.3)

 const tBot = THREE.MathUtils.clamp((-0.252 - y) / (DIAMOND_HALF - 0.252), 0, 1)
 const sBot = tBot * tBot * (3 - 2 * tBot)

 const tTop = THREE.MathUtils.clamp((y - 0.268) / (DIAMOND_HALF - 0.268), 0, 1)
 const tRight = THREE.MathUtils.clamp((x - 0.218) / (DIAMOND_HALF - 0.218), 0, 1)
 const tLeft = THREE.MathUtils.clamp((-0.268 - x) / (DIAMOND_HALF - 0.268), 0, 1)
 // Graceful outward paper curl at the three un-slotted diamond corners (kept < 0.020 total Z).
 const cornerLift =
  0.0112 * Math.pow(tTop, 1.75)
  + 0.0128 * Math.pow(tRight, 1.65)
  + 0.0096 * Math.pow(tLeft, 1.75)

 return Math.max(0, (base + vFold + hFold + seamRipple + wave) * (1 - sBot) + cornerLift)
}

/**
 * Builds a closed thin double-sided square doufang (`|x| + |y| <= 0.48`) mapped on a
 * 45-degree-rotated square grid so sheet UVs and cut-paper edges align cleanly with all
 * four diagonal diamond borders.
 */
function createFuSheetGeometry(): THREE.BufferGeometry {
 const positions: number[] = []
 const uvs: number[] = []
 const colors: number[] = []
 const indices: number[] = []

 const frontGrid: [number, number, number][] = []
 const backGrid: [number, number, number][] = []

 for (let iv = 0; iv <= GRID_SEG; iv++) {
  const vn = (iv / GRID_SEG) * 2 - 1 // -1..1
  for (let iu = 0; iu <= GRID_SEG; iu++) {
   const un = (iu / GRID_SEG) * 2 - 1 // -1..1
   const x = 0.24 * (un - vn)
   const y = 0.24 * (un + vn)
   const zBack = evalFuSheetBackZ(x, y)
   frontGrid.push([x, y, zBack + SHEET_T])
   backGrid.push([x, y, zBack])
  }
 }

 // Front (+Z) and back (-Z) faces.
 for (let side = 0; side < 2; side++) {
  const grid = side === 0 ? frontGrid : backGrid
  const backTone = side === 0 ? 1.0 : 0.93
  for (let iv = 0; iv <= GRID_SEG; iv++) {
   const vUv = iv / GRID_SEG
   for (let iu = 0; iu <= GRID_SEG; iu++) {
    const uUv = iu / GRID_SEG
    const k = iv * GRID_SIDE + iu
    const [x, y] = grid[k]!
    positions.push(x, y, grid[k]![2])
    uvs.push(uUv, vUv)

    // Delicate quarter-fold memory and plank-seam crease shading on handmade red xuan paper.
    const vCrease = Math.exp(-Math.pow(x / 0.018, 2))
    const hCrease = Math.exp(-Math.pow(y / 0.018, 2))
    const quadLight = (x < 0 ? 0.018 : -0.018) + (y > 0 ? 0.020 : -0.020)
    const seam = Math.exp(-Math.pow((x - 0.128) / 0.018, 2)) + Math.exp(-Math.pow((x + 0.128) / 0.018, 2))
    const edgeWarm = Math.pow(Math.max(Math.abs(uUv * 2 - 1), Math.abs(vUv * 2 - 1)), 4) * 0.04
    const shade = (1 + quadLight - (vCrease + hCrease) * 0.042 - seam * 0.034 + edgeWarm) * backTone
    colors.push(shade, shade * 0.99, shade * 0.975)
   }
  }
 }

 const quad = (a: number, b: number, c: number, d: number) => indices.push(a, b, c, a, c, d)
 for (let iv = 0; iv < GRID_SEG; iv++) {
  for (let iu = 0; iu < GRID_SEG; iu++) {
   const a = iv * GRID_SIDE + iu
   // In (u, v) -> (x = .24*(u-v), y = .24*(u+v)), Jacobian det = +0.1152 > 0,
   // so (a, a+1, a+GRID_SIDE+1, a+GRID_SIDE) is CCW facing +Z.
   quad(a, a + 1, a + GRID_SIDE + 1, a + GRID_SIDE)
   quad(GRID_COUNT + a, GRID_COUNT + a + GRID_SIDE, GRID_COUNT + a + GRID_SIDE + 1, GRID_COUNT + a + 1)
  }
 }

 // Closed perimeter cut-paper rim wrapping all four diagonal borders.
 const perimeter: [number, number][] = []
 for (let iu = 0; iu <= GRID_SEG; iu++) perimeter.push([iu, 0])
 for (let iv = 1; iv <= GRID_SEG; iv++) perimeter.push([GRID_SEG, iv])
 for (let iu = GRID_SEG - 1; iu >= 0; iu--) perimeter.push([iu, GRID_SEG])
 for (let iv = GRID_SEG - 1; iv >= 0; iv--) perimeter.push([0, iv])

 const edgeStart = GRID_COUNT * 2
 for (const [iu, iv] of perimeter) {
  const k = iv * GRID_SIDE + iu
  const f = frontGrid[k]!
  const b = backGrid[k]!
  positions.push(f[0], f[1], f[2], b[0], b[1], b[2])
  const uUv = iu / GRID_SEG
  const vUv = iv / GRID_SEG
  uvs.push(uUv, vUv, uUv, vUv)
  // Lighter warm rose-ivory cut-paper pulp core along the thin edge.
  colors.push(1.14, 0.96, 0.88, 1.14, 0.96, 0.88)
 }
 for (let i = 0; i < perimeter.length - 1; i++) {
  const f0 = edgeStart + i * 2
  const b0 = f0 + 1
  const f1 = f0 + 2
  const b1 = f0 + 3
  quad(f0, b0, b1, f1)
 }

 const geometry = new THREE.BufferGeometry()
 geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
 geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
 geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
 geometry.setIndex(indices)
 geometry.computeVertexNormals()
 geometry.computeBoundingBox()
 geometry.computeBoundingSphere()
 return geometry
}

let cachedFuPieceBuffers: { positions: Float32Array; normals: Float32Array; uvs: Float32Array; indices: Uint32Array }[] | null = null

/**
 * Builds conforming brush-calligraphy 「福」 meshes from the bundled Ma Shan Zheng
 * (SIL OFL 1.1) subset, projected flush onto the curving red xuan-paper front surface
 * (`zFront + 0.00042`) with matching 45-degree sheet UVs for seamless paper tooth.
 */
function createFuCalligraphyPieces(): THREE.BufferGeometry[] {
 if (!cachedFuPieceBuffers) {
  const layout = layoutTextPolygons('mashanZheng', '福', {
   center: true,
   fitBox: [0.43, 0.445],
   flatness: 0.004,
  })
  const pieces = createProgressivePolygonsSlices(layout.polygons, 12, {
   direction: 'y-desc',
   maxEdgeLength: 0.042,
   deformVertex(x, y, out) {
    const py = y + 0.006
    out.set(x, py, evalFuSheetBackZ(x, py) + SHEET_T + 0.00042)
   },
  })
  cachedFuPieceBuffers = pieces.map((piece) => {
   const uvAttr = piece.geometry.getAttribute('uv') as THREE.BufferAttribute
   for (let i = 0; i < uvAttr.count; i++) {
    const x = piece.coords2D[i * 2]!
    const y = piece.coords2D[i * 2 + 1]! + 0.006
    uvAttr.setXY(i, (x + y) / 0.96 + 0.5, (y - x) / 0.96 + 0.5)
   }
   const p = piece.geometry.getAttribute('position') as THREE.BufferAttribute
   const n = piece.geometry.getAttribute('normal') as THREE.BufferAttribute
   const ix = piece.geometry.getIndex()!
   const buf = {
    positions: new Float32Array(p.array as Float32Array),
    normals: new Float32Array(n.array as Float32Array),
    uvs: new Float32Array(uvAttr.array as Float32Array),
    indices: Uint32Array.from(ix.array),
   }
   piece.geometry.dispose()
   return buf
  })
 }
 return cachedFuPieceBuffers.map((buf) => {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(buf.positions), 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(buf.normals), 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(buf.uvs), 2))
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(buf.indices), 1))
  geo.computeBoundingBox()
  geo.computeBoundingSphere()
  return geo
 })
}

/** Prepared red Fu paper, Ma Shan Zheng (SIL OFL 1.1) brush glyph and a product-designed household doorway. */
export function createChineseFuPaperModel() {
 const root=new THREE.Group();root.name='chinese-fu-paper-root'
 const subject=new THREE.Group();subject.name='chinese-fu-paper-subject';root.add(subject)
 const paper=new THREE.Group();paper.name='fu-paper';subject.add(paper)
 const mat=(color:number)=>new THREE.MeshStandardMaterial({color,roughness:.94})
 const red=createRitualMaterial({
  color:0xc83329,
  roughness:.95,
  vertexColors:true,
 },{
  kind:'paper',
  strength:.34,
  fiber:'paper',
  paper:{
   layout:'sheet',
   aspect:1.0,
   grainScale:3.4,
   grain:.86,
   fibers:.02,
   edge:.44,
   highlightGuard:.52,
  },
 })
 const ink=createRitualMaterial({
  color:0x1e1916,
  roughness:.96,
  polygonOffset:true,
  polygonOffsetFactor:-1,
  polygonOffsetUnits:-1,
 },{
  kind:'paper',
  strength:.08,
  fiber:'paper',
  paper:{
   layout:'sheet',
   aspect:1.0,
   grainScale:3.4,
   grain:.44,
   fibers:0,
   edge:0,
   highlightGuard:.25,
  },
 })
 const wood=mat(0x99734e),woodX=mat(0x99734e),frame=mat(0x78563c),frameX=mat(0x78563c),brass=mat(0xb19965)
 ;[wood,frame].forEach(material=>applyCraftSurface(material,{kind:'wood',strength:.4,axis:'y'}))
 ;[woodX,frameX].forEach(material=>applyCraftSurface(material,{kind:'wood',strength:.4,axis:'x'}))
 applyCraftSurface(brass,{kind:'metal',strength:.45})
 let serial=0
 const mesh=(g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D,name?:string)=>{const o=new THREE.Mesh(g,m);o.name=name??`fu-detail-${serial++}`;o.castShadow=o.receiveShadow=true;parent.add(o);return o}
 const box=(name:string,size:[number,number,number],pos:[number,number,number],m:THREE.Material,parent:THREE.Object3D=subject,bevel=.014)=>{const r=Math.min(bevel,size[0]/3,size[1]/3,size[2]/3);const o=mesh(new RoundedBoxGeometry(size[0],size[1],size[2],2,r),m,parent,name);o.position.set(...pos);return o}
 const door=new THREE.Group();door.name='fu-door-leaf';subject.add(door)
 // Adjacent planks have the same front plane: the completed paper is flush across them.
 for(let i=0;i<5;i++)box(`fu-door-plank-${i}`,[1.28/5-.003,2.10,.16],[-.22+(i+.5)*1.28/5,1.05,-.11],applyCraftSurface(mat([0xa48057,0x9f7951,0xa88259,0x9c764f,0xa27d55][i]!),{kind:'wood',strength:.4,axis:'y'}),door,.009)
 box('fu-frame-left',[.10,2.16,.24],[-.28,1.08,-.05],frame,subject,.016)
 box('fu-frame-right',[.10,2.16,.24],[1.12,1.08,-.05],frame,subject,.016)
 box('fu-frame-top',[1.60,.13,.24],[.42,2.15,-.04],frameX,subject,.016)
 box('fu-threshold',[1.60,.055,.30],[.42,-.0275,-.03],woodX,subject,.013)
 const handle=mesh(new THREE.TorusGeometry(.06,.012,8,32),brass,subject,'fu-door-handle');handle.position.set(.87,.45,.018)
 box('fu-handle-mount',[.035,.055,.033],[.87,.51,-.012],brass,subject,.006)
 // A low chamfered display holder supports the diamond tip. Front/back rails leave a real slot.
 box('fu-holder-base',[.38,.09,.29],[-.88,-.01,.55],woodX,subject,.014)
 box('fu-holder-back',[.26,.15,.015],[-.88,.11,.535],woodX,subject,.004)
 box('fu-holder-shelf',[.29,.02,.085],[-.88,.15,.565],frameX,subject,.005)
 box('fu-holder-front',[.26,.11,.015],[-.88,.215,.58],woodX,subject,.004)
 mesh(createFuSheetGeometry(),red,paper,'fu-red-sheet')
 const glyph=new THREE.Group();glyph.name='fu-glyph';paper.add(glyph)
 // Upright brush-calligraphy 「福」 from Ma Shan Zheng (SIL OFL 1.1), conformed flush to the red xuan-paper sheet.
 createFuCalligraphyPieces().forEach((geo, i) => {
  const o = new THREE.Mesh(geo, ink)
  o.name = `fu-ink-${i}`
  o.castShadow = false
  o.receiveShadow = true
  o.userData.toonSurface = { outline: false }
  glyph.add(o)
 })
 // Two restrained stone edges ground this small entry vignette, without a temple reconstruction.
 box('fu-entry-slab',[2.75,.05,1.35],[-.1,-.08,.19],applyCraftSurface(mat(0xc8bba3),{kind:'stone',strength:.45}),root)
 const positions:[number,number,number][]=[[-.88,.64,.55],[-.88,1.06,.55],[.42,1.26,.55],[.42,1.38,-.029]]
 const pose=(step:number,n:number)=>{
  const t=Number.isFinite(n)?THREE.MathUtils.clamp(n,0,1):0,index=THREE.MathUtils.clamp(Math.floor(step),0,3)
  const a=positions[index]!,b=positions[Math.min(index+1,3)]!
  paper.rotation.set(0,0,0)
  if(t===0||index===3)paper.position.set(...a)
  else if(t===1)paper.position.set(...b)
  else paper.position.set(THREE.MathUtils.lerp(a[0],b[0],t),THREE.MathUtils.lerp(a[1],b[1],t),THREE.MathUtils.lerp(a[2],b[2],t))
  root.updateMatrixWorld(true)
 }
 pose(0,0)
 return{root,subject,paper,targets:[paper,paper,paper],roots:[paper,paper,paper],anchors:[[0,0,.012],[0,0,.012],[0,0,.012]] as [number,number,number][],pose}
}
