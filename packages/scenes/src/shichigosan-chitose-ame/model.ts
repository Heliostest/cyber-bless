import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import * as THREE from 'three'
import { addSteppedPedestal } from '../cozy-furniture'

const BAG_BOTTOM_Y = 0.008
const BAG_TOP_Y = 0.668
const BAG_WALL_T = 0.0046
const BAG_HALF_W_BOT = 0.190
const BAG_HALF_W_TOP = 0.184
const BAG_HALF_D_BOT = 0.088
const BAG_HALF_D_TOP = 0.084

function hash2(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

/**
 * Deterministic 256x512 front paper print DataTexture (WebGL + jsdom safe).
 * Renders the original coral lower color block and five-petal coral blossom with cream center
 * as matte ink absorbed into handmade cream paper, keeping paper fiber tooth continuous across ink.
 */
function createBagFrontPrintMap(width = 256, height = 512): THREE.DataTexture {
  const data = new Uint8Array(width * height * 4)
  // Base warm cream-ivory washi matching original celebratory palette, coral ink (0xd77b76), cream flower center.
  const baseR = 248, baseG = 235, baseB = 194
  const coralR = 215, coralG = 114, coralB = 108
  const centerR = 253, centerG = 246, centerB = 222

  // Normalized coordinates matching bag front (width 0.376, height 0.660: y in [0.008, 0.668]).
  const bagW = 0.376, bagH = BAG_TOP_Y - BAG_BOTTOM_Y
  const flowerCy = (0.37 - BAG_BOTTOM_Y) / bagH

  for (let iy = 0; iy < height; iy++) {
    const v = iy / (height - 1)
    const yWorld = BAG_BOTTOM_Y + v * bagH
    for (let ix = 0; ix < width; ix++) {
      const u = ix / (width - 1)
      const xWorld = (u - 0.5) * bagW

      // Subtle paper fiber grain variation in print absorption (no synthetic grid).
      const grain = (hash2(ix, iy, 41) - 0.5) * 0.045
      let r = baseR, g = baseG, b = baseB

      // Original lower coral color band (x in [-0.165, 0.165], y in [0.042, 0.158]) with soft matte ink feather.
      const bandDx = Math.max(0, Math.abs(xWorld) - 0.164)
      const bandDy = Math.max(0, 0.044 - yWorld, yWorld - 0.156)
      const bandDist = Math.hypot(bandDx, bandDy)
      const bandAlpha = 1 - THREE.MathUtils.smoothstep(bandDist, 0.0, 0.0032)

      // Original 5-petal coral blossom at (0, 0.37) with soft matte ink edges.
      let petalAlpha = 0
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2
        const px = Math.sin(a) * 0.042
        const py = 0.37 + Math.cos(a) * 0.042
        const d = Math.hypot(xWorld - px, yWorld - py)
        const alpha = 1 - THREE.MathUtils.smoothstep(d, 0.030, 0.0335)
        if (alpha > petalAlpha) petalAlpha = alpha
      }
      const centerDist = Math.hypot(xWorld, yWorld - (BAG_BOTTOM_Y + flowerCy * bagH))
      const centerAlpha = 1 - THREE.MathUtils.smoothstep(centerDist, 0.019, 0.022)

      // Subtle decorative cream hairline inside top edge of coral band and whisper-fine top-cuff crease tint.
      const coralAlpha = Math.max(bandAlpha, petalAlpha) * (0.94 + grain)
      if (coralAlpha > 0.001) {
        const a = THREE.MathUtils.clamp(coralAlpha, 0, 1)
        r = THREE.MathUtils.lerp(r, coralR, a)
        g = THREE.MathUtils.lerp(g, coralG, a)
        b = THREE.MathUtils.lerp(b, coralB, a)
      }
      if (centerAlpha > 0.001) {
        const a = THREE.MathUtils.clamp(centerAlpha, 0, 1)
        r = THREE.MathUtils.lerp(r, centerR, a)
        g = THREE.MathUtils.lerp(g, centerG, a)
        b = THREE.MathUtils.lerp(b, centerB, a)
      }

      // Subtle paper fold-hem line near top mouth (y = 0.618) and lower fold crease (y = 0.024).
      const cuffShade = 1 - 0.045 * Math.exp(-Math.pow((yWorld - 0.618) / 0.0045, 2))
      const botCrease = 1 - 0.055 * Math.exp(-Math.pow((yWorld - 0.026) / 0.007, 2))
      const mult = cuffShade * botCrease * (1 + grain * 0.4)

      const idx = (iy * width + ix) * 4
      data[idx] = THREE.MathUtils.clamp(Math.round(r * mult), 0, 255)
      data[idx + 1] = THREE.MathUtils.clamp(Math.round(g * mult), 0, 255)
      data[idx + 2] = THREE.MathUtils.clamp(Math.round(b * mult), 0, 255)
      data[idx + 3] = 255
    }
  }

  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  tex.magFilter = tex.minFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}

/**
 * Closed outward-wound thin folded paper wall builder shared across all four sides of the gift bag.
 * `evalPoint(u, v)` returns outer surface point, inner surface point, outer shade, and inner shade
 * where `(u_dir x v_dir)` points strictly outward.
 */
function createBagWallGeometry(
  cols: number,
  rows: number,
  evalPoint: (u: number, v: number) => {
    outer: [number, number, number]
    inner: [number, number, number]
    outerShade: number
    innerShade: number
  },
): THREE.BufferGeometry {
  const stride = cols + 1
  const gridVerts = (cols + 1) * (rows + 1)
  const positions: number[] = []
  const uvs: number[] = []
  const colors: number[] = []
  const indices: number[] = []

  const outerPts: [number, number, number][] = new Array(gridVerts)
  const innerPts: [number, number, number][] = new Array(gridVerts)
  const outShades: number[] = new Array(gridVerts)
  const inShades: number[] = new Array(gridVerts)

  for (let iv = 0; iv <= rows; iv++) {
    const v = iv / rows
    for (let iu = 0; iu <= cols; iu++) {
      const u = iu / cols
      const res = evalPoint(u, v)
      const idx = iv * stride + iu
      outerPts[idx] = res.outer
      innerPts[idx] = res.inner
      outShades[idx] = res.outerShade
      inShades[idx] = res.innerShade
    }
  }

  // Outer surface (0 .. gridVerts - 1).
  for (let iv = 0; iv <= rows; iv++) {
    const v = iv / rows
    for (let iu = 0; iu <= cols; iu++) {
      const u = iu / cols
      const idx = iv * stride + iu
      const p = outerPts[idx]!
      const s = outShades[idx]!
      positions.push(p[0], p[1], p[2])
      uvs.push(u, v)
      colors.push(s, s, s)
    }
  }
  for (let iv = 0; iv < rows; iv++) {
    for (let iu = 0; iu < cols; iu++) {
      const a = iv * stride + iu
      const b = a + 1
      const c = a + stride + 1
      const d = a + stride
      indices.push(a, b, c, a, c, d)
    }
  }

  // Inner surface (gridVerts .. 2 * gridVerts - 1).
  const inBase = gridVerts
  for (let iv = 0; iv <= rows; iv++) {
    const v = iv / rows
    for (let iu = 0; iu <= cols; iu++) {
      const u = iu / cols
      const idx = iv * stride + iu
      const p = innerPts[idx]!
      const s = inShades[idx]!
      positions.push(p[0], p[1], p[2])
      uvs.push(0.04 + u * 0.04, 0.04 + v * 0.04)
      colors.push(s, s, s)
    }
  }
  for (let iv = 0; iv < rows; iv++) {
    for (let iu = 0; iu < cols; iu++) {
      const a = inBase + iv * stride + iu
      const b = a + 1
      const c = a + stride + 1
      const d = a + stride
      indices.push(a, c, b, a, d, c)
    }
  }

  // Closed CCW perimeter edge strips (crisp thin paper rim along top cuff, bottom crease, and corners).
  const ring: number[] = []
  for (let iu = 0; iu < cols; iu++) ring.push(iu)
  for (let iv = 0; iv < rows; iv++) ring.push(iv * stride + cols)
  for (let iu = cols; iu > 0; iu--) ring.push(rows * stride + iu)
  for (let iv = rows; iv > 0; iv--) ring.push(iv * stride)

  for (let k = 0; k < ring.length; k++) {
    const i0 = ring[k]!
    const i1 = ring[(k + 1) % ring.length]!
    const o0 = outerPts[i0]!, n0 = innerPts[i0]!, n1 = innerPts[i1]!, o1 = outerPts[i1]!
    const s0 = outShades[i0]! * 0.96, s1 = outShades[i1]! * 0.96
    const base = positions.length / 3
    positions.push(
      o0[0], o0[1], o0[2],
      n0[0], n0[1], n0[2],
      n1[0], n1[1], n1[2],
      o1[0], o1[1], o1[2],
    )
    uvs.push(0.02, 0.96, 0.02, 0.96, 0.04, 0.96, 0.04, 0.96)
    colors.push(s0, s0, s0, s0 * 0.92, s0 * 0.92, s0 * 0.92, s1 * 0.92, s1 * 0.92, s1 * 0.92, s1, s1, s1)
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

/** Original family gift composition; the three motions are an interaction arrangement. */
export function createChitoseAmeModel(){
 const root=new THREE.Group();root.name='chitose-root'
 const subject=new THREE.Group();subject.name='chitose-subject';root.add(subject)
 const mat=(color:number,roughness=.8)=>new THREE.MeshStandardMaterial({color,roughness})
 const frontPrintMap = createBagFrontPrintMap(256, 512)
 const frontPaperMat = createRitualMaterial({
  color: 0xffffff,
  map: frontPrintMap,
  roughness: 0.96,
  vertexColors: true,
 }, {
  kind: 'paper',
  strength: 0.26,
  fiber: 'paper',
  paper: { layout: 'sheet', aspect: 0.58, grainScale: 2.3, grain: 1.0, fibers: 0.16, edge: 0.42, highlightGuard: 0.90 },
 })
 const releaseFrontPrint = () => {
  frontPaperMat.removeEventListener('dispose', releaseFrontPrint)
  frontPrintMap.dispose()
 }
 frontPaperMat.addEventListener('dispose', releaseFrontPrint)

 const bagPaperMat = createRitualMaterial({
  color: 0xf7e8bc,
  roughness: 0.96,
  vertexColors: true,
 }, {
  kind: 'paper',
  strength: 0.28,
  fiber: 'paper',
  paper: { layout: 'sheet', aspect: 0.44, grainScale: 2.4, grain: 1.0, fibers: 0.16, edge: 0.44, highlightGuard: 0.90 },
 })
 const floorPaperMat = createRitualMaterial({
  color: 0xe9d6a4,
  roughness: 0.97,
 }, {
  kind: 'paper',
  strength: 0.20,
  fiber: 'paper',
  paper: { layout: 'sheet', aspect: 1.8, grainScale: 2.8, grain: 0.90, fibers: 0.12, edge: 0.34, highlightGuard: 0.90 },
 })
 const wrapperPaperMat = createRitualMaterial({
  color: 0xfbf0d0,
  roughness: 0.94,
 }, {
  kind: 'paper',
  strength: 0.24,
  fiber: 'paper',
  paper: { layout: 'sheet', aspect: 1.4, grainScale: 3.0, grain: 0.88, fibers: 0.12, edge: 0.30, highlightGuard: 0.90 },
 })
 const coral=mat(0xd77b76),skin=mat(0xdba47a),coat=mat(0xd8ac57),pants=mat(0x5f7e78),hair=mat(0x715244),dark=mat(0x443c35),shoe=mat(0x876657),cord=mat(0xc95855),redCandy=mat(0xe48b8b,.34),whiteCandy=mat(0xffefce,.34)
 applyCraftSurface(cord, { kind: 'cord', strength: .3 })
 applyCraftSurface(coat, { kind: 'fabric', strength: .26 })
 applyCraftSurface(pants, { kind: 'fabric', strength: .26 })

 const mesh=(g:THREE.BufferGeometry,m:THREE.Material,p:THREE.Object3D,name:string)=>{const o=new THREE.Mesh(g,m);o.name=name;o.castShadow=true;o.receiveShadow=true;p.add(o);return o}
 const box=(name:string,size:[number,number,number],pos:[number,number,number],m:THREE.Material,p:THREE.Object3D=subject)=>{const o=mesh(new THREE.BoxGeometry(...size),m,p,name);o.position.set(...pos);return o}
 const ball=(name:string,pos:[number,number,number],scale:[number,number,number],m:THREE.Material,p:THREE.Object3D=subject)=>{const o=mesh(new THREE.SphereGeometry(1,24,24),m,p,name);o.position.set(...pos);o.scale.set(...scale);return o}
 const rod=(name:string,radius:number,m:THREE.Material,p:THREE.Object3D=subject)=>mesh(new THREE.CylinderGeometry(radius,radius,1,24),m,p,name)
 const place=(o:THREE.Mesh,a:THREE.Vector3,b:THREE.Vector3)=>{const d=b.clone().sub(a);o.position.copy(a).add(b).multiplyScalar(.5);o.scale.y=d.length();o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize())}
 const v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z)
 const GROUND_Y=-.0475
 // Compact stepped stone candy-bag stand grounded directly on courtyard stones (-0.0475)
 // replaces the redundant round stone floor disc and sharp square block while preserving bag height (0.18).
 const giftPedestal=addSteppedPedestal(subject,{
  name:'chitose-gift-rest',
  topName:'chitose-gift-rest-top',
  shape:'rect',
  kind:'stone',
  color:0xcac6ac,
  trimColor:0xb5b096,
  center:[-.56,.4],
  groundY:GROUND_Y,
  surfaceY:.18,
  tiers:[
   {width:.56,depth:.40,height:.068,color:0xb5b096},
   {width:.50,depth:.34,height:.115,color:0xc4bfa5},
   {width:.53,depth:.37,height:.0445,color:0xcac6ac},
  ],
 })
 giftPedestal.root.name='chitose-gift-rest'
 const rest=giftPedestal.root
 const bag=new THREE.Group();bag.name='chitose-bag-root';subject.add(bag)

 // Folded paper gift bag: solid paper bottom (top flush at y = 0.018), thin tapered front & back
 // walls with gentle organic paper belly and folded top cuff, plus V-pleated side gussets.
 const floor=box('chitose-bag-floor',[.374,.018,.170],[0,.009,0],floorPaperMat,bag)

 const halfWAt = (vNorm: number) => THREE.MathUtils.lerp(BAG_HALF_W_BOT, BAG_HALF_W_TOP, vNorm)
 const halfDAt = (vNorm: number) => THREE.MathUtils.lerp(BAG_HALF_D_BOT, BAG_HALF_D_TOP, vNorm)
 const cuffFoldExtra = (vNorm: number) => THREE.MathUtils.smoothstep(vNorm, 0.91, 0.935) * 0.0032
 const innerMouthShade = (vNorm: number) => THREE.MathUtils.lerp(0.60, 0.88, Math.pow(vNorm, 1.35))

 // Front wall (+Z outward): carries the matte-printed original coral band & 5-petal blossom.
 const frontGeo = createBagWallGeometry(16, 24, (u, vNorm) => {
  const y = THREE.MathUtils.lerp(BAG_BOTTOM_Y, BAG_TOP_Y, vNorm)
  const hw = halfWAt(vNorm)
  const hd = halfDAt(vNorm)
  const x = (u * 2 - 1) * hw
  const belly = 0.0046 * Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.pow(vNorm, 0.88))
  const zOut = hd + belly
  const zIn = zOut - BAG_WALL_T - cuffFoldExtra(vNorm)
  const edgeCornerAO = 1 - 0.06 * Math.pow(Math.abs(u * 2 - 1), 6)
  const bottomAO = 1 - 0.07 * Math.pow(1 - vNorm, 8)
  return {
   outer: [x, y, zOut],
   inner: [x, y, zIn],
   outerShade: edgeCornerAO * bottomAO,
   innerShade: innerMouthShade(vNorm),
  }
 })
 const front = mesh(frontGeo, frontPaperMat, bag, 'chitose-bag-front')
 front.userData.toonSurface = { shading: 'smooth' }

 // Back wall (-Z outward): mirrors the paper taper & belly with a subtle pasted vertical back seam.
 const backGeo = createBagWallGeometry(16, 24, (u, vNorm) => {
  const y = THREE.MathUtils.lerp(BAG_BOTTOM_Y, BAG_TOP_Y, vNorm)
  const hw = halfWAt(vNorm)
  const hd = halfDAt(vNorm)
  const x = (1 - u * 2) * hw
  const belly = 0.0042 * Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.pow(vNorm, 0.88))
  const seamStep = 0.0014 * THREE.MathUtils.smoothstep(u, 0.64, 0.66)
  const zOut = -(hd + belly + seamStep)
  const zIn = zOut + BAG_WALL_T + cuffFoldExtra(vNorm)
  const seamAO = 1 - 0.07 * Math.exp(-Math.pow((u - 0.64) / 0.025, 2))
  const edgeCornerAO = 1 - 0.06 * Math.pow(Math.abs(u * 2 - 1), 6)
  const cuffLine = 1 - 0.045 * Math.exp(-Math.pow((vNorm - 0.925) / 0.012, 2))
  return {
   outer: [x, y, zOut],
   inner: [x, y, zIn],
   outerShade: seamAO * edgeCornerAO * cuffLine,
   innerShade: innerMouthShade(vNorm),
  }
 })
 const back = mesh(backGeo, bagPaperMat, bag, 'chitose-bag-back')
 back.userData.toonSurface = { shading: 'smooth' }

 // Left & right V-pleated side gussets (inward center pleat clearing candies by >4.9cm, flaring softly at bottom fold).
 for (const sign of [-1, 1] as const) {
  const sideGeo = createBagWallGeometry(12, 24, (u, vNorm) => {
   const y = THREE.MathUtils.lerp(BAG_BOTTOM_Y, BAG_TOP_Y, vNorm)
   const hw = halfWAt(vNorm)
   const hd = halfDAt(vNorm)
   // On +X wall (sign=1), u=0..1 runs +Z..-Z so (u_dir x +Y) = +X outward.
   // On -X wall (sign=-1), u=0..1 runs -Z..+Z so (u_dir x +Y) = -X outward.
   const z = sign === 1 ? THREE.MathUtils.lerp(hd, -hd, u) : THREE.MathUtils.lerp(-hd, hd, u)
   const centerFold = 1 - Math.abs(u * 2 - 1) // 0 at corners, 1 at center V-crease
   // Crisp V-pleat deepens cleanly above the folded square base and holds an authentic V-notch through the mouth.
   const pleatProfile = THREE.MathUtils.smoothstep(vNorm, 0.04, 0.20) * (1 - 0.10 * THREE.MathUtils.smoothstep(vNorm, 0.88, 1.0))
   const pleatDepth = 0.044 * Math.pow(centerFold, 1.25) * pleatProfile
   const xOut = sign * (hw - pleatDepth)
   const xIn = sign * (hw - pleatDepth - BAG_WALL_T - cuffFoldExtra(vNorm) * 0.7)
   // Crisp V-valley fold shading & diagonal bottom triangular gusset fold crease.
   const valleyAO = 1 - 0.28 * Math.pow(centerFold, 1.35) * pleatProfile
   const botTriCrease = 1 - 0.09 * Math.exp(-Math.pow((vNorm - 0.16 * (1 - centerFold)) / 0.025, 2))
   const cuffLine = 1 - 0.04 * Math.exp(-Math.pow((vNorm - 0.925) / 0.012, 2))
   return {
    outer: [xOut, y, z],
    inner: [xIn, y, z],
    outerShade: valleyAO * botTriCrease * cuffLine,
    innerShade: innerMouthShade(vNorm) * (1 - 0.12 * centerFold),
   }
  })
  const side = mesh(sideGeo, bagPaperMat, bag, 'chitose-bag-side-' + sign)
  side.userData.toonSurface = { shading: 'smooth' }
 }

 const handle=mesh(new THREE.TorusGeometry(.13,.012,12,96),cord,bag,'chitose-handle');handle.position.set(0,.75,.102)
 const grip=rod('chitose-grip',.018,cord,bag);place(grip,v(-.045,.88,.102),v(.045,.88,.102))
 const candies=[-1,1].map((sign,i)=>{const c=mesh(new THREE.CylinderGeometry(.026,.026,.74,24),i===0?redCandy:whiteCandy,bag,'chitose-wrapped-candy-'+i);c.position.set(sign*.065,.388,0);return c})
 for(const [i,x]of [-.065,.065].entries()){
  // Flattened sealed wrapper ends and a neck band remain visible above the bag mouth.
  box('chitose-wrapper-seal-'+i,[.054,.038,.014],[x,.765,0],wrapperPaperMat,bag)
  const collar=mesh(new THREE.TorusGeometry(.025,.003,12,24),wrapperPaperMat,bag,'chitose-wrapper-band-'+i);collar.rotation.x=Math.PI/2;collar.position.set(x,.735,0)
  for(let j=0;j<3;j++)box('chitose-wrapper-crimp-'+i+'-'+j,[.003,.027,.002],[x+(j-1)*.012,.769,.008],coral,bag)
 }
 const child=new THREE.Group();child.name='chitose-child';subject.add(child)
 for(const [i,x]of [.295,.505].entries()){
  ball('chitose-shoe-'+i,[x,GROUND_Y+.045,.035],[.083,.045,.14],shoe,child)
  const leg=rod('chitose-trouser-leg-'+i,.067,pants,child);place(leg,v(x,.035,0),v(x,.64,0))
 }
 ball('chitose-hips',[.4,.65,0],[.19,.16,.12],pants,child)
 ball('chitose-coat',[.4,.94,0],[.22,.30,.145],coat,child)
 const neck=rod('chitose-neck',.062,skin,child);place(neck,v(.4,1.16,0),v(.4,1.30,0))
 ball('chitose-head',[.4,1.43,0],[.17,.20,.15],skin,child)
 ball('chitose-hair',[.4,1.572,-.025],[.159,.075,.138],hair,child)
 for(const [i,x]of [.225,.575].entries())ball('chitose-ear-'+i,[x,1.43,0],[.026,.047,.033],skin,child)
 ball('chitose-nose',[.4,1.408,.150],[.024,.030,.023],skin,child)
 for(const [i,x]of [.34,.46].entries())ball('chitose-eye-'+i,[x,1.46,.1425],[.009,.013,.005],dark,child)
 const smile=rod('chitose-smile',.005,dark,child);place(smile,v(.375,1.35,.139),v(.425,1.35,.139))
 const elbows=[v(.14,1.20,.13),v(.66,1.20,.13)]
 const upperArms=[rod('chitose-sleeve-0',.069,coat,child),rod('chitose-sleeve-1',.069,coat,child)]
 const forearms=[rod('chitose-forearm-0',.022,skin,child),rod('chitose-forearm-1',.022,skin,child)]
 const palms=[ball('chitose-palm-0',[0,0,0],[.035,.035,.035],skin,child),ball('chitose-palm-1',[0,0,0],[.035,.035,.035],skin,child)]
 for(let i=0;i<2;i++){place(upperArms[i]!,v(i===0?.18:.62,1.10,0),elbows[i]!);ball('chitose-elbow-'+i,elbows[i]!.toArray() as [number,number,number],[.043,.043,.043],skin,child)}
 const angles=[2*Math.PI/3,Math.PI/3],contacts=angles.map(a=>v(Math.cos(a)*.13,Math.sin(a)*.13,0))
 const finalHands=angles.map(a=>v(.4+Math.cos(a)*.083,.42+.75+Math.sin(a)*.083,.4+.102))
 const waiting=[v(.24,1.25,.17),v(.56,1.25,.17)]
 const positions=[v(-.56,.18,.4),v(-.56,.64,.4),v(.4,.64,.4),v(.4,.42,.4)]
 const pose=(step:number,t:number)=>{
  const s=THREE.MathUtils.clamp(Math.floor(step),0,3),n=THREE.MathUtils.clamp(t,0,1)
  bag.position.copy(positions[s]!)
  if(s<2)bag.position.lerp(positions[s+1]!,n)
  if(s===2)bag.position.lerp(positions[3]!,Math.min(n*2,1))
  const reach=s===3?1:s===2?Math.max(0,n*2-1):0
  for(let i=0;i<2;i++){
   // Align behind the opening before reaching through it to support the cord.
   const aligned=finalHands[i]!.clone();aligned.z=waiting[i]!.z
   palms[i]!.position.copy(waiting[i]!).lerp(aligned,Math.min(reach*2,1))
   if(reach>.5)palms[i]!.position.lerp(finalHands[i]!,reach*2-1)
   place(forearms[i]!,elbows[i]!,palms[i]!.position)
  }
  root.updateMatrixWorld(true)
 }
 pose(0,0)
 return {root,subject,bag,handle,grip,candies,child,palms,contacts,rest,floor,front,pose,targets:[grip,grip,grip],roots:[bag,bag,bag],anchors:[new THREE.Vector3(0,0,.025),new THREE.Vector3(0,0,.025),new THREE.Vector3(0,0,.025)]}
}
