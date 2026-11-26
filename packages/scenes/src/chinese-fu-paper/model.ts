import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import * as THREE from 'three'

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

/**
 * Builds one tapered original brush-ink stroke conforming flush onto the curving red
 * xuan-paper front surface (`zFront + 0.00042`), preserving the scene's original upright
 * 15-stroke 福 structure without borrowing any historical calligrapher's hand.
 */
function createConformingBrushStroke(
 spine: readonly [number, number][],
 halfWidths: readonly number[],
): THREE.BufferGeometry {
 // Densify polyline smoothly for conforming curvature and clean tapered ends.
 const pts: [number, number, number][] = []
 const subPerSeg = 4
 for (let s = 0; s < spine.length - 1; s++) {
  const [x0, y0] = spine[s]!
  const [x1, y1] = spine[s + 1]!
  const w0 = halfWidths[s]!
  const w1 = halfWidths[s + 1]!
  const start = s === 0 ? 0 : 1
  for (let j = start; j <= subPerSeg; j++) {
   const t = j / subPerSeg
   pts.push([THREE.MathUtils.lerp(x0, x1, t), THREE.MathUtils.lerp(y0, y1, t), THREE.MathUtils.lerp(w0, w1, t)])
  }
 }

 const positions: number[] = []
 const uvs: number[] = []
 const indices: number[] = []
 const leftPts: [number, number][] = []
 const rightPts: [number, number][] = []

 for (let i = 0; i < pts.length; i++) {
  const prev = pts[Math.max(0, i - 1)]!
  const next = pts[Math.min(pts.length - 1, i + 1)]!
  let tx = next[0] - prev[0]
  let ty = next[1] - prev[1]
  const len = Math.hypot(tx, ty) || 1
  tx /= len; ty /= len
  const nx = -ty, ny = tx
  const [px, py, hw] = pts[i]!
  leftPts.push([px + nx * hw, py + ny * hw])
  rightPts.push([px - nx * hw, py - ny * hw])
 }

 const pushPt = (x: number, y: number) => {
  const z = evalFuSheetBackZ(x, y) + SHEET_T + 0.00042
  positions.push(x, y, z)
  const u = (x + y) / 0.96 + 0.5
  const v = (y - x) / 0.96 + 0.5
  uvs.push(u, v)
 }

 // Rounded brush entry cap.
 const startPt = pts[0]!
 const startNext = pts[1]!
 const sLen = Math.hypot(startNext[0] - startPt[0], startNext[1] - startPt[1]) || 1
 const sTx = (startNext[0] - startPt[0]) / sLen
 const sTy = (startNext[1] - startPt[1]) / sLen
 pushPt(startPt[0] - sTx * startPt[2] * 0.65, startPt[1] - sTy * startPt[2] * 0.65) // idx 0

 for (let i = 0; i < pts.length; i++) {
  pushPt(leftPts[i]![0], leftPts[i]![1])
  pushPt(rightPts[i]![0], rightPts[i]![1])
 }

 // Rounded brush exit cap.
 const endPt = pts[pts.length - 1]!
 const endPrev = pts[pts.length - 2]!
 const eLen = Math.hypot(endPt[0] - endPrev[0], endPt[1] - endPrev[1]) || 1
 const eTx = (endPt[0] - endPrev[0]) / eLen
 const eTy = (endPt[1] - endPrev[1]) / eLen
 const endCapIdx = 1 + pts.length * 2
 pushPt(endPt[0] + eTx * endPt[2] * 0.68, endPt[1] + eTy * endPt[2] * 0.68)

 // Entry triangle (+Z CCW: cap -> right0 -> left0).
 indices.push(0, 2, 1)
 for (let i = 0; i < pts.length - 1; i++) {
  const l0 = 1 + i * 2
  const r0 = l0 + 1
  const l1 = l0 + 2
  const r1 = l0 + 3
  indices.push(r0, r1, l1, r0, l1, l0)
 }
 const lastL = 1 + (pts.length - 1) * 2
 const lastR = lastL + 1
 indices.push(lastR, endCapIdx, lastL)

 const geometry = new THREE.BufferGeometry()
 geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
 geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
 geometry.setIndex(indices)
 geometry.computeVertexNormals()
 geometry.computeBoundingBox()
 geometry.computeBoundingSphere()
 return geometry
}

/** Prepared red Fu paper, original brush-tapered glyph and a product-designed household doorway. */
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
 const wood=mat(0x99734e),frame=mat(0x78563c),brass=mat(0xb19965)
 ;[wood,frame].forEach(material=>applyCraftSurface(material,{kind:'wood',strength:.4,axis:'y'}))
 applyCraftSurface(brass,{kind:'metal',strength:.45})
 let serial=0
 const mesh=(g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D,name?:string)=>{const o=new THREE.Mesh(g,m);o.name=name??`fu-detail-${serial++}`;o.castShadow=o.receiveShadow=true;parent.add(o);return o}
 const box=(name:string,size:[number,number,number],pos:[number,number,number],m:THREE.Material,parent:THREE.Object3D=subject)=>{const o=mesh(new THREE.BoxGeometry(...size),m,parent,name);o.position.set(...pos);return o}
 const door=new THREE.Group();door.name='fu-door-leaf';subject.add(door)
 // Adjacent planks have the same front plane: the completed paper is flush across them.
 for(let i=0;i<5;i++)box(`fu-door-plank-${i}`,[1.28/5-.003,2.10,.16],[-.22+(i+.5)*1.28/5,1.05,-.11],applyCraftSurface(mat([0xa48057,0x9f7951,0xa88259,0x9c764f,0xa27d55][i]!),{kind:'wood',strength:.4,axis:'y'}),door)
 box('fu-frame-left',[.10,2.16,.24],[-.28,1.08,-.05],frame)
 box('fu-frame-right',[.10,2.16,.24],[1.12,1.08,-.05],frame)
 box('fu-frame-top',[1.60,.13,.24],[.42,2.15,-.04],frame)
 box('fu-threshold',[1.60,.08,.30],[.42,-.04,-.03],wood)
 const handle=mesh(new THREE.TorusGeometry(.06,.012,8,32),brass,subject,'fu-door-handle');handle.position.set(.87,.45,.018)
 box('fu-handle-mount',[.035,.055,.033],[.87,.51,-.012],brass)
 // A low display holder supports the diamond tip. Front/back rails leave a real slot.
 box('fu-holder-base',[.38,.115,.29],[-.88,-.0225,.55],wood)
 box('fu-holder-back',[.26,.15,.015],[-.88,.11,.535],wood)
 box('fu-holder-shelf',[.29,.02,.085],[-.88,.15,.565],frame)
 box('fu-holder-front',[.26,.11,.015],[-.88,.215,.58],wood)
 mesh(createFuSheetGeometry(),red,paper,'fu-red-sheet')
 const glyph=new THREE.Group();glyph.name='fu-glyph';paper.add(glyph)
 // Original 15-stroke upright 福 (礻 + 一 / 口 / 田), rendered as conforming matte sumi brush ribbons.
 const brush=(name:string,spine:[number,number][],widths:number[])=>{
  const o=new THREE.Mesh(createConformingBrushStroke(spine,widths),ink)
  o.name=name;o.castShadow=false;o.receiveShadow=true
  o.userData.toonSurface={outline:false}
  glyph.add(o);return o
 }
 brush('fu-left-dot',[[-.214,.228],[-.184,.214],[-.156,.194]],[.014,.022,.017])
 brush('fu-left-turn',[[-.260,.137],[-.180,.141],[-.096,.142],[-.132,.092],[-.178,.034]],[.018,.015,.022,.017,.011])
 brush('fu-left-stem',[[-.178,.082],[-.178,-.076],[-.178,-.230]],[.020,.017,.015])
 brush('fu-left-little-dot',[[-.144,.002],[-.114,-.026],[-.086,-.056]],[.013,.019,.015])
 brush('fu-right-one',[[-.010,.248],[.088,.252],[.184,.254]],[.018,.014,.019])
 brush('fu-mouth-top',[[-.008,.165],[.094,.168],[.196,.165]],[.017,.014,.019])
 brush('fu-mouth-left',[[.000,.164],[.003,.104],[.005,.044]],[.017,.015,.016])
 brush('fu-mouth-right',[[.190,.164],[.186,.104],[.182,.044]],[.019,.016,.017])
 brush('fu-mouth-bottom',[[.000,.044],[.092,.046],[.184,.044]],[.016,.014,.017])
 brush('fu-field-top',[[-.018,-.036],[.096,-.032],[.208,-.036]],[.018,.014,.019])
 brush('fu-field-left',[[-.010,-.036],[-.007,-.134],[-.005,-.228]],[.018,.015,.017])
 brush('fu-field-right',[[.202,-.036],[.198,-.134],[.192,-.228]],[.019,.016,.017])
 brush('fu-field-bottom',[[-.010,-.228],[.092,-.225],[.194,-.228]],[.017,.015,.018])
 brush('fu-field-middle-horizontal',[[.012,-.142],[.096,-.140],[.180,-.142]],[.014,.013,.015])
 brush('fu-field-middle-vertical',[[.096,-.036],[.096,-.132],[.096,-.226]],[.016,.014,.015])
 // Two restrained stone edges ground this small entry vignette, without a temple reconstruction.
 box('fu-entry-slab',[2.75,.06,1.35],[-.1,-.11,.19],applyCraftSurface(mat(0xc8bba3),{kind:'stone',strength:.45}),root)
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
