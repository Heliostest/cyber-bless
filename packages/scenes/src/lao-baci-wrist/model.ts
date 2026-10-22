import * as THREE from 'three'

/** Close view of a guest's offered wrist. The pointer supplies the tying hand. */
export function createBaciModel() {
  const root = new THREE.Group(); root.name = 'baci-root'
  const subject = new THREE.Group(); subject.name = 'baci-subject'; root.add(subject)
  const mat = (color: number, roughness = .85) => new THREE.MeshStandardMaterial({ color, roughness })
  const skin = mat(0xc78d68), nail = mat(0xe1b899), cloth = mat(0x57938b), hem = mat(0xe4b976), cotton = mat(0xfff9e9), straw = mat(0xc7ae79)
  const mesh = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D = subject) => {
    const m = new THREE.Mesh(geometry, material); m.name = name; m.castShadow = true; m.receiveShadow = true; parent.add(m); return m
  }
  const ball = (name: string, position: number[], scale: number[], material: THREE.Material) => {
    const m = mesh(name, new THREE.SphereGeometry(1, 24, 16), material); m.position.fromArray(position); m.scale.fromArray(scale); return m
  }
  const wrist = new THREE.Vector3(.25, .47, 0)
  const ground = mesh('baci-woven-mat', new THREE.CylinderGeometry(1.45, 1.49, .055, 64), straw); ground.scale.z = .77; ground.position.y = -.0275
  // Recessed parallel strands give the mat a modest woven surface without a table.
  for (let i = -10; i <= 10; i++) {
    const z = i*.09, length = 2.72*Math.sqrt(Math.max(0, 1-z*z/1.12**2))
    const line = mesh('baci-mat-weft-'+i, new THREE.CylinderGeometry(.004,.004,length,6), mat(i%2?0xb89c69:0xd9c08e))
    line.rotation.z = Math.PI/2; line.position.set(0,.004,z)
  }
  ball('baci-sleeve',[-.88,.47,0],[.47,.24,.29],cloth)
  const cuff = mesh('baci-cuff',new THREE.CylinderGeometry(.245,.245,.085,32),hem); cuff.rotation.z = Math.PI/2; cuff.scale.z=1.16; cuff.position.set(-.53,.47,0)
  ball('baci-forearm',[-.13,.47,0],[.59,.15,.185],skin)
  ball('baci-palm',[.65,.47,0],[.31,.115,.235],skin)
  // Palm faces up; unequal fingers and a separate thumb preserve a hand silhouette.
  for (const [i,z] of [-.16,-.055,.055,.16].entries()) {
    const length=[.25,.32,.30,.23][i]!
    ball('baci-finger-'+i,[.90+length*.38,.475,z],[length,.065,.047],skin)
    ball('baci-nail-'+i,[.99+length*.4,.526,z],[.058,.009,.032],nail)
  }
  const thumb=ball('baci-thumb',[.63,.47,.30],[.20,.08,.08],skin); thumb.rotation.y=-.55
  const thread = new THREE.Group(); thread.name='baci-thread'; subject.add(thread)
  const yarn = mesh('baci-cotton-strand',new THREE.BufferGeometry(),cotton,thread)
  const caps = [0,1].map(i=>{const cap=mesh('baci-thread-end-'+i,new THREE.SphereGeometry(.012,12,8),cotton,thread);return cap})
  let local: THREE.Vector3[]=[], previousTie=-1, previousLift=-1
  const v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z)
  const pose=(step:number,amount:number)=>{
    const n=Number.isFinite(step)?THREE.MathUtils.clamp(Math.floor(step),0,3):0,t=Number.isFinite(amount)?THREE.MathUtils.clamp(amount,0,1):0
    const lift=n===0?t:1,wrap=n===1?t:n>1?1:0,tie=n===2?t:n>2?1:0
    const approach=Math.min(1,wrap/.25),lower=THREE.MathUtils.clamp((wrap-.25)/.20,0,1),slide=THREE.MathUtils.clamp((wrap-.45)/.35,0,1),snug=THREE.MathUtils.clamp((wrap-.8)/.2,0,1)
    // Carry the open loop above the offered hand, lower it beyond the fingers,
    // then bring it back to the wrist before gathering the ends. The generous
    // opening clears the thumb; no part is interpolated through the body.
    thread.position.set(THREE.MathUtils.lerp(-.57,1.5,approach)+(wrist.x-1.5)*slide,THREE.MathUtils.lerp(.028,.88,lift)+(wrist.y-.88)*lower,.65*(1-approach))
    thread.scale.z=1+1.5*approach*(1-snug)
    thread.rotation.z=-(1-lift)*Math.PI/2
    if(tie===previousTie && lift===previousLift){root.updateMatrixWorld(true);return}
    previousTie=tie;previousLift=lift
    const ry=.169,rz=.207
    local=[]
    // An open strand: the ends occupy opposite sides of the wrist loop's gap.
    // The knot has a raised crossing; separate sections never share a centre.
    const tail=.20*(1-tie)+.105*tie
    for(let i=0;i<=16;i++){const u=i/16;local.push(v(-.025-.115*(1-u),ry+.025+tail*(1-u),-.045*(1-u)))}
    for(let i=1;i<=96;i++){const u=i/96,a=u*Math.PI*2;local.push(v(-.025+.05*u,ry*Math.cos(a)+.025,rz*Math.sin(a)))}
    const knot=[v(.025,.194,0),v(.075,.24,.035),v(.075,.30,.035),v(-.01,.325,.03),v(-.075,.28,-.035),v(-.015,.24,-.045),v(.02,.28,-.045),v(.13,.34,-.005)]
    const knotted=new THREE.CatmullRomCurve3(knot,false,'centripetal')
    for(let i=1;i<=48;i++){const u=i/48,p=knotted.getPoint(u),straight=v(.025+.14*u,.194+(.20+tail)*u,.05*u);local.push(straight.lerp(p,tie))}
    // A genuinely open, planar coil lies on the mat. Its two tails splay out
    // on opposite sides of the gap, then lift into the three dimensional pose.
    if(lift<1)local=local.map((p,index)=>{
      let flat:THREE.Vector3
      if(index<=16){const u=index/16;flat=v(0,ry+.025+.20*(1-u),.06+.10*(1-u))}
      else if(index<=112){const u=(index-16)/96,a=.28+(Math.PI*2-.56)*u;flat=v(0,ry*Math.cos(a)+.025,rz*Math.sin(a))}
      else{const u=(index-112)/48;flat=v(0,ry*Math.cos(.28)+.025+(.594-ry*Math.cos(.28)-.025)*u,-rz*Math.sin(.28)-.123*u)}
      return flat.lerp(p,lift)
    })
    const curve=new THREE.CatmullRomCurve3(local,false,'centripetal')
    yarn.geometry.dispose(); yarn.geometry=new THREE.TubeGeometry(curve,192,.012,8,false)
    caps[0]!.position.copy(local[0]!);caps[1]!.position.copy(local.at(-1)!)
    root.updateMatrixWorld(true)
  }
  pose(0,0)
  return { root,subject,thread,wrist,pose,targets:[thread,thread,thread],roots:[thread,thread,thread],
    anchors:[[0,.394,.16],[-.14,.394,-.045],[-.14,.394,-.045]] as [number,number,number][],
    threadPoints:()=>local.map(p=>thread.localToWorld(p.clone())),dispose(){} }
}
