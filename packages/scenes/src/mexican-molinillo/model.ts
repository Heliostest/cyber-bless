import { createVesselLiquid } from '@wbr/scene-runtime/vessel-liquid'
import * as THREE from 'three'

type XYZ = [number, number, number]
/** Original appreciation model: no collection replica, recipe, or fluid simulation. */
export function createMolinilloModel() {
  const subject = new THREE.Group(); subject.name = 'molinillo-subject'
  const whisk = new THREE.Group(); whisk.name = 'molinillo-whisk'; subject.add(whisk)
  const wood = new THREE.MeshStandardMaterial({ color: 0xc58b4e, roughness: .81 })
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x8c512e, roughness: .89 })
  const clay = new THREE.MeshPhysicalMaterial({ color: 0xa95032, roughness: .34, clearcoat: .3, clearcoatRoughness: .28 })
  const cream = new THREE.MeshStandardMaterial({ color: 0xe9c89a, roughness: .74 })
  const chocolate = new THREE.MeshPhysicalMaterial({ color: 0x5e3020, roughness: .3, clearcoat: .4 })
  const foamUniforms = { uFoamTime: { value: 0 }, uFoamSwirl: { value: 0 }, uFoamAmp: { value: 0 } }
  const makeFoamMat = (color: number, roughness: number, key: string) => {
    const mat = new THREE.MeshStandardMaterial({ color, roughness })
    mat.customProgramCacheKey = () => `molinillo-living-foam-v1:${key}`
    mat.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, foamUniforms)
      shader.vertexShader = `uniform float uFoamTime;\nuniform float uFoamSwirl;\nuniform float uFoamAmp;\n` + shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vec4 wbrFmW = modelMatrix * vec4(transformed, 1.0);
        float wbrFmAng = atan(wbrFmW.z, wbrFmW.x);
        float wbrFmR = length(wbrFmW.xz);
        float wbrFmWave = sin(wbrFmAng * 3.0 - wbrFmR * 4.5 + uFoamSwirl * 1.4 + uFoamTime * 2.2) * 0.6
          + cos(wbrFmW.x * 8.0 + wbrFmW.z * 7.5 - uFoamTime * 1.8) * 0.4;
        transformed.y += wbrFmWave * uFoamAmp;
      `)
    }
    return mat
  }
  const foam = makeFoamMat(0xbc8757, .76, 'base')
  const foamLight = makeFoamMat(0xd4a16c, .8, 'light')
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, p: XYZ, parent: THREE.Group = subject) => {
    const m = new THREE.Mesh(geometry, material); m.name = name; m.position.set(...p); m.castShadow = m.receiveShadow = true; parent.add(m); return m
  }
  const lathe = (points: [number, number][]) => new THREE.LatheGeometry(points.map(([x,y]) => new THREE.Vector2(x,y)), 64)
  add('molinillo-cup',lathe([[0,-.03],[.61,-.03],[.7,.04],[.79,.23],[.9,.53],[.98,.87],[1,.96],[.99,1.01],[.93,1.015],[.9,.95],[.86,.58],[.73,.24],[.58,.12],[0,.12]]),clay,[0,0,0])
  const cupHandle=add('molinillo-cup-handle',new THREE.TorusGeometry(.32,.075,12,40),clay,[1.11,.56,0]);cupHandle.scale.set(1.1,1.3,1)
  const rim=add('molinillo-cream-rim',new THREE.TorusGeometry(.962,.032,12,64),cream,[0,.988,0]);rim.rotation.x=Math.PI/2
  const foot=add('molinillo-foot-ring',new THREE.TorusGeometry(.66,.025,8,64),clay,[0,.025,0]);foot.rotation.x=Math.PI/2
  const liquid=add('molinillo-chocolate',new THREE.CircleGeometry(.888,64),chocolate,[0,.878,0]);liquid.rotation.x=-Math.PI/2;liquid.castShadow=false
  const cocoaSurface = createVesselLiquid({
    preset: 'spiced-cocoa', radius: .886, radialSegments: 16, angularSegments: 48, deformMode: 'gpu',
    color: 0x5c331c, edgeColor: 0xc99265, deepColor: 0x2f160a, foamColor: 0xe6c8a2, foamStrength: .72,
    opacity: 1, roughness: .26, meniscusHeight: .032, maxAmplitude: .044, seed: 8011, name: 'molinillo-cocoa-surface',
  })
  cocoaSurface.mesh.position.set(0, .881, 0); subject.add(cocoaSurface.mesh)
  // A fluted lathed head straddles the air/liquid interface after immersion.
  const headGeometry=lathe([[0,.62],[.14,.63],[.26,.69],[.31,.80],[.29,.92],[.21,1.0],[.11,1.03]])
  const vertices=headGeometry.getAttribute('position') as THREE.BufferAttribute
  for(let i=0;i<vertices.count;i++){
    const x=vertices.getX(i),z=vertices.getZ(i),a=Math.atan2(z,x),groove=.86+.14*Math.cos(10*a)
    vertices.setXYZ(i,x*groove,vertices.getY(i),z*groove)
  }
  headGeometry.computeVertexNormals();headGeometry.computeBoundingSphere()
  add('molinillo-fluted-head',headGeometry,wood,[0,0,0],whisk)
  // The handle itself is the only selectable solid; no invisible hit proxy.
  const handle=add('molinillo-handle',new THREE.CylinderGeometry(.095,.115,1.64,32),wood,[0,1.91,0],whisk)
  add('molinillo-neck',new THREE.CylinderGeometry(.105,.11,.49,24),wood,[0,1.235,0],whisk)
  const cap=add('molinillo-handle-cap',new THREE.SphereGeometry(.107,24,12),wood,[0,2.74,0],whisk);cap.scale.y=.65
  const rings=[1.08,1.26].map((y,i)=>{
    add('molinillo-collar-'+i,new THREE.CylinderGeometry(.24,.24,.07,32),darkWood,[0,y-.08,0],whisk)
    const ring=add('molinillo-ring-'+i,new THREE.TorusGeometry(.18,.045,10,48).rotateX(Math.PI/2),wood,[0,y,0],whisk)
    // Small inlaid bands make the free ring's lag visible without invented symbols.
    for(let j=0;j<4;j++){
      const band=new THREE.Mesh(new THREE.TorusGeometry(.18,.046,8,5,.18).rotateX(Math.PI/2),darkWood)
      band.name=`molinillo-ring-band-${i}-${j}`;band.rotation.y=j*Math.PI/2;ring.add(band)
    }
    return ring
  })
  add('molinillo-ring-stop',new THREE.CylinderGeometry(.24,.24,.05,32),darkWood,[0,1.34,0],whisk)
  for(let i=0;i<3;i++){
    const line=add('molinillo-handle-band-'+i,new THREE.TorusGeometry(.111-i*.003,.008,8,32),darkWood,[0,1.44+i*.075,0],whisk);line.rotation.x=Math.PI/2
  }
  // An offset grain streak reveals rolling on an otherwise round wooden shaft.
  const grain=add('molinillo-grain',new THREE.BoxGeometry(.025,.33,.007),darkWood,[.044,2.48,.086],whisk);grain.rotation.y=.4
  const bubbleGeometry=new THREE.SphereGeometry(1,12,8)
  const bubbles=Array.from({length:68},(_,i)=>{
    const a=i*2.3999632297,r=.38+.405*Math.sqrt((i+.5)/68),size=.030+(i%5)*.009
    const b=add('molinillo-bubble-'+i,bubbleGeometry,i%4===0?foamLight:foam,[r*Math.cos(a),.89,r*Math.sin(a)])
    b.userData.toonSurface={outline:false};return {mesh:b,size,threshold:(i%17)/20}
  })
  function pose(step:number,amount:number) {
    const n=THREE.MathUtils.clamp(amount,0,1), immersed=step>0?1:n
    whisk.position.y=.65*(1-immersed)
    // A right roll followed by a left roll; ring rotation lags relative to the shaft.
    const roll=step===1?n:step===2?1-n:0
    whisk.rotation.y=roll*Math.PI*2.4
    rings.forEach((ring,i)=>{ring.rotation.y=-roll*Math.PI*(.75+i*.15)})
    const aeration=step<1?0:step===1?n*.5:step===2?.5+n*.5:1
    bubbles.forEach(({mesh,size,threshold})=>{
      const growth=THREE.MathUtils.clamp((aeration-threshold)*4,0,1)
      mesh.scale.set(size*growth,size*growth*.42,size*growth);mesh.visible=growth>0
    })
  }
  pose(0,0)
  let liquidClock = 0, wakeAngle = 0, wakeAccum = 0, disposed = false
  function updateLiquid(dt: number, reduced: boolean) {
    const stepDt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, .05) : 0
    if (!reduced) liquidClock += stepDt
    cocoaSurface.update(stepDt, liquidClock, reduced)
    const energy = Math.abs(cocoaSurface.state.swirlVelocity) * .12 + Math.hypot(cocoaSurface.state.sloshX, cocoaSurface.state.sloshZ) + cocoaSurface.state.activeRipples * .25
    foamUniforms.uFoamTime.value = reduced ? 0 : liquidClock
    foamUniforms.uFoamSwirl.value = reduced ? 0 : cocoaSurface.state.swirlPhase
    foamUniforms.uFoamAmp.value = reduced ? 0 : THREE.MathUtils.clamp(.008 + energy * .022, .008, .036)
  }
  function immerseCocoa() {
    cocoaSurface.addDipDepression(0, 0, .032, .34)
    cocoaSurface.triggerRipple(0, 0, 1.15)
    cocoaSurface.addTiltImpulse(.75, -.55)
  }
  function stirCocoa(deltaRoll: number) {
    if (!Number.isFinite(deltaRoll) || Math.abs(deltaRoll) < 1e-4) return
    cocoaSurface.addSwirlImpulse(THREE.MathUtils.clamp(deltaRoll * 18, -8, 8))
    wakeAngle += deltaRoll * Math.PI * 2.4
    wakeAccum += Math.abs(deltaRoll)
    if (wakeAccum >= .08) {
      wakeAccum = 0
      const rx = Math.cos(wakeAngle) * .28, rz = Math.sin(wakeAngle) * .28
      cocoaSurface.triggerRipple(rx, rz, THREE.MathUtils.clamp(.62 + Math.abs(deltaRoll) * 3.2, .62, 1.15))
      cocoaSurface.addTiltImpulse(Math.cos(wakeAngle) * .45, Math.sin(wakeAngle) * .45)
    }
  }
  function resetLiquid() {
    liquidClock = 0; wakeAccum = 0
    cocoaSurface.reset()
    foamUniforms.uFoamTime.value = 0; foamUniforms.uFoamSwirl.value = 0; foamUniforms.uFoamAmp.value = 0
  }
  function dispose() {
    if (disposed) return
    disposed = true
    cocoaSurface.dispose()
  }
  return {
    subject, pose, updateLiquid, immerseCocoa, stirCocoa, resetLiquid, dispose,
    targets: [handle, handle, handle], anchors: [[0, .15, 0], [0, .15, 0], [0, .15, 0]] as XYZ[],
  }
}
