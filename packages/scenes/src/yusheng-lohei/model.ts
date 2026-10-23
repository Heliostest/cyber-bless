import * as THREE from 'three'

// Authored geometry is deterministic; cache only measured placement heights, never live objects.
const layoutCache=new Map<string,number[]>()

/** A shared festive platter, with hand-held chopsticks and individual solid ingredients. */
export function createYushengModel() {
  const root = new THREE.Group(); root.name = 'yusheng-root'
  const subject = new THREE.Group(); subject.name = 'yusheng-subject'; root.add(subject)
  const material = (color:string, roughness=.72) => new THREE.MeshStandardMaterial({color,roughness,metalness:0})
  const porcelain=material('#fff1d8',.38), celadon=material('#4f9990',.45), wood=material('#b47d4e'), bamboo=material('#804936'), gold=material('#e8b74e',.4)
  const ingredients=[material('#ef9e3d'),material('#f5edc9'),material('#a4bf66'),material('#d6717b'),material('#deba78')]
  const salmon=material('#ee907b',.48), fishFat=material('#fbe4bc',.48), green=material('#528b56'), sesame=material('#e5c185')
  // Cylinder/lathe poles contain mathematical zero-area triangles; retain all real faces.
  const finish=(source:THREE.BufferGeometry)=>{
    const raw=source.index?source.toNonIndexed():source,p=raw.getAttribute('position'),faces:number[]=[]
    for(let i=0;i<p.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),c=new THREE.Vector3().fromBufferAttribute(p,i+2);if(new THREE.Triangle(a,b,c).getArea()>1e-12)faces.push(...a.toArray(),...b.toArray(),...c.toArray())}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(faces,3));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();if(raw!==source)raw.dispose();source.dispose();return g
  }
  const mesh=(name:string,geometry:THREE.BufferGeometry,mat:THREE.Material,parent:THREE.Object3D)=>{const m=new THREE.Mesh(finish(geometry),mat);m.name=name;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
  const lathe=(p:number[][])=>new THREE.LatheGeometry(p.map(v=>new THREE.Vector2(v[0]!,v[1]!)),64)
  const table=mesh('round-dining-table',new THREE.CylinderGeometry(1.78,1.78,.14,64),wood,root);table.position.y=.09
  const tableApron=mesh('table-apron',new THREE.CylinderGeometry(1.69,1.69,.15,64),material('#91613f'),root);tableApron.position.y=-.045
  const plate=mesh('shared-porcelain-platter',lathe([[0,0],[.98,0],[1.30,.07],[1.36,.12],[1.36,.15],[1.30,.15],[.99,.078],[0,.078]]),porcelain,root);plate.position.y=.16
  const rim=mesh('celadon-platter-band',lathe([[1.30,.146],[1.355,.146],[1.355,.151],[1.30,.151],[1.30,.146]]),celadon,root);rim.position.copy(plate.position)
  // Small plates and seats identify a shared meal; none is a wish board or altar.
  for(let i=0;i<3;i++){
    const angle=(i*2*Math.PI/3)+.3,x=Math.sin(angle)*1.57,z=Math.cos(angle)*1.57
    const side=mesh('side-plate-'+i,lathe([[0,0],[.20,0],[.26,.025],[.26,.045],[.21,.045],[.19,.018],[0,.018]]),porcelain,root);side.position.set(x,.16,z)
  }
  const food:THREE.Group[]=[],homes:THREE.Vector3[]=[],peaks:THREE.Vector3[]=[],ends:THREE.Vector3[]=[]
  const frac=(n:number)=>n-Math.floor(n)
  function piece(name:string,geometry:THREE.BufferGeometry,mat:THREE.Material,index:number,category:number) {
    const group=new THREE.Group();group.name=name;subject.add(group);mesh(name+'-body',geometry,mat,group)
    const angle=category*2*Math.PI/5+(frac(index*.618)-.5)*1.1,r=.10+.66*Math.sqrt(frac(index*.367))
    const y=.267+.095*frac(index*.723)
    homes.push(new THREE.Vector3(Math.sin(angle)*r,y,Math.cos(angle)*r))
    const finalAngle=index*2.399963,finalR=.10+.68*Math.sqrt(frac(index*.413))
    ends.push(new THREE.Vector3(Math.sin(finalAngle)*finalR,.266+.08*frac(index*.177),Math.cos(finalAngle)*finalR))
    const rises=index%4!==0
    peaks.push(new THREE.Vector3(Math.sin(finalAngle)*(.15+.45*frac(index*.81)),y+(rises?.73+.32*frac(index*.53):.025),Math.cos(finalAngle)*(.16+.50*frac(index*.49))))
    group.userData.turn=index*.473;food.push(group);return group
  }
  for(let i=0;i<168;i++){
    const center=[[-.12,0],[-.04,.018],[.05,-.018],[.14,.015]],width=.012+(i%3)*.002
    const outline=[...center.map(([x,z])=>new THREE.Vector2(x!,z!+width)),...center.slice().reverse().map(([x,z])=>new THREE.Vector2(x!,z!-width))]
    const strip=new THREE.Shape(outline);strip.closePath()
    // Capped extrusions remain solid when the tossed strips turn toward the camera.
    piece('vegetable-strip-'+i,new THREE.ExtrudeGeometry(strip,{depth:.018,bevelEnabled:false}).rotateX(-Math.PI/2).scale(1+(i%4)*.12,1,1),ingredients[i%5]!,i,i%5)
  }
  const fishShape=new THREE.Shape([new THREE.Vector2(-.16,-.07),new THREE.Vector2(.11,-.085),new THREE.Vector2(.17,.04),new THREE.Vector2(-.11,.075)]);fishShape.closePath()
  for(let i=0;i<8;i++){
    const g=piece('fish-slice-'+i,new THREE.ExtrudeGeometry(fishShape,{depth:.024,bevelEnabled:false}).rotateX(-Math.PI/2),salmon,168+i,i%5)
    for(let j=0;j<3;j++){const stripe=mesh('fish-fat-'+i+'-'+j,new THREE.BoxGeometry(.012,.003,.12),fishFat,g);stripe.position.set(-.085+j*.065,.025,0);stripe.rotation.y=.22}
  }
  for(let i=0;i<14;i++)piece('flour-crisp-'+i,new THREE.BoxGeometry(.105,.032,.095),ingredients[4]!,176+i,i%5)
  const leafShape=new THREE.Shape([new THREE.Vector2(-.07,0),new THREE.Vector2(-.11,.045),new THREE.Vector2(-.025,.065),new THREE.Vector2(0,.12),new THREE.Vector2(.035,.07),new THREE.Vector2(.10,.035),new THREE.Vector2(.065,0)]);leafShape.closePath()
  for(let i=0;i<10;i++)piece('coriander-leaf-'+i,new THREE.ExtrudeGeometry(leafShape,{depth:.008,bevelEnabled:false}).rotateX(-Math.PI/2),green,190+i,i%5)
  for(let i=0;i<16;i++)piece('sesame-'+i,new THREE.SphereGeometry(.017,8,6).scale(.6,.35,1),sesame,200+i,i%5)
  const downRay=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0)),sample=new THREE.Vector3()
  function stack(layout:THREE.Vector3[],yawOffset:number,key:string) {
    const cached=layoutCache.get(key),placed:THREE.Object3D[]=[plate]
    for(let i=0;i<food.length;i++){
      const group=food[i]!,location=layout[i]!
      group.position.set(location.x,0,location.z);group.rotation.y=group.userData.turn+yawOffset;root.updateMatrixWorld(true)
      let height=cached?.[i]??-Infinity
      if(!cached){
        // Every unique ingredient vertex samples real surfaces beneath it. Taking the
        // largest required translation provides a contact while clearing those surfaces.
        const samples=new Map<string,THREE.Vector3>()
        group.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh)return;const p=m.geometry.getAttribute('position');for(let n=0;n<p.count;n++){sample.fromBufferAttribute(p,n).applyMatrix4(m.matrixWorld);samples.set(sample.toArray().map(v=>Math.round(v*1e6)).join(','),sample.clone())}})
        const bottom=Math.min(...[...samples.values()].map(v=>v.y))
        for(const v of samples.values()){
          downRay.ray.origin.set(v.x,5,v.z);const hit=downRay.intersectObjects(placed,true)[0]
          if(hit)height=Math.max(height,hit.point.y-bottom)
        }
      }
      location.y=Number.isFinite(height)?height:.238;group.position.y=location.y;root.updateMatrixWorld(true);placed.push(group)
    }
    if(!cached)layoutCache.set(key,layout.map(p=>p.y))
  }
  stack(homes,0,'home-v3');stack(ends,1.6,'end-v3')
  for(let i=0;i<food.length;i++)peaks[i]!.y=homes[i]!.y+(i%4!==0?.73+.32*frac(i*.53):.025)
  const diners:THREE.Group[]=[]
  const skins=[material('#dba986'),material('#ba8463'),material('#e1ba99')],sleeves=[material('#dc7767'),material('#72aaa0'),material('#82a7bf')]
  const rod=(name:string,a:THREE.Vector3,b:THREE.Vector3,parent:THREE.Object3D,mat:THREE.Material,tip=.026,end=.045)=>{
    const delta=b.clone().sub(a),m=mesh(name,new THREE.CylinderGeometry(end,tip,delta.length(),10),mat,parent);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m
  }
  for(let i=0;i<3;i++){
    const group=new THREE.Group();group.name=i===0?'diner-chopsticks':'companion-chopsticks-'+i;subject.add(group);diners.push(group)
    for(const side of[-1,1]){
      rod('chopstick-'+i+'-'+side,new THREE.Vector3(side*.045,0,0),new THREE.Vector3(side*.12,1.50,0),group,bamboo)
      const band=mesh('chopstick-gold-band-'+i+'-'+side,new THREE.CylinderGeometry(.046,.046,.055,10),gold,group);band.position.set(side*.111,1.32,0);band.rotation.z=-side*.05
    }
    const palm=mesh('diner-palm-'+i,new THREE.SphereGeometry(1,16,10).scale(.19,.24,.12),skins[i]!,group);palm.position.set(.02,1.42,-.04)
    for(let finger=0;finger<3;finger++){const f=mesh('diner-finger-'+i+'-'+finger,new THREE.CapsuleGeometry(.038,.20,4,8),skins[i]!,group);f.position.set(-.04,1.28+finger*.07,.07);f.rotation.z=1.35}
    const sleeve=mesh('diner-sleeve-'+i,new THREE.CylinderGeometry(.22,.17,.36,16),sleeves[i]!,group);sleeve.position.set(.025,1.72,-.04)
    const cuff=mesh('diner-cuff-'+i,new THREE.CylinderGeometry(.176,.176,.07,16),porcelain,group);cuff.position.set(.025,1.515,-.04)
  }
  const direction=new THREE.Vector3(),lerp=THREE.MathUtils.lerp,dipCenters:THREE.Vector3[]=[],dipHeights:number[]=[]
  // Pick an actual broad fish surface for each pair, rather than stopping over a gap.
  food.forEach((f,i)=>{f.position.copy(homes[i]!);f.rotation.y=f.userData.turn});root.updateMatrixWorld(true)
  for(let i=0;i<3;i++){
    const angle=i*2*Math.PI/3+1.3,wanted=new THREE.Vector3(Math.sin(angle)*.28,0,Math.cos(angle)*.28)
    const candidates=food.filter(f=>f.name.startsWith('fish-slice'))
    candidates.sort((a,b)=>Math.hypot(a.position.x-wanted.x,a.position.z-wanted.z)-Math.hypot(b.position.x-wanted.x,b.position.z-wanted.z))
    const picked=candidates[0]!,center=picked.position.clone();dipCenters.push(center)
    downRay.ray.origin.set(center.x,5,center.z);dipHeights.push((downRay.intersectObjects(food,true)[0]?.point.y??center.y)-.008)
  }
  function pose(step:number,amount:number) {
    const s=Number.isFinite(step)?THREE.MathUtils.clamp(step,0,3):0,t=Number.isFinite(amount)?THREE.MathUtils.clamp(amount,0,1):0,phase=Math.min(3,s+t)
    for(let i=0;i<food.length;i++){
      const f=food[i]!,home=homes[i]!,peak=peaks[i]!,end=ends[i]!
      if(phase<=1)f.position.copy(home)
      else if(phase<=2)f.position.lerpVectors(home,peak,phase-1)
      else f.position.lerpVectors(peak,end,1-(3-phase)**2)
      f.rotation.set(0,f.userData.turn+(phase>1?(phase-1)*.8:0),0)
    }
    for(let i=0;i<diners.length;i++){
      const group=diners[i]!,angle=i*2*Math.PI/3+1.3,center=dipCenters[i]!,dip=dipHeights[i]!
      let withdraw=.12,height=dip+.30
      if(phase<=1){height=lerp(dip+.30,dip,phase);withdraw=lerp(.12,0,phase)}
      else if(phase<=2){height=lerp(dip,dip+.87,phase-1);withdraw=lerp(0,.10,phase-1)}
      else{height=lerp(dip+.87,dip+.22,phase-2);withdraw=lerp(.10,.25,phase-2)}
      group.position.set(center.x+Math.sin(angle)*withdraw,height,center.z+Math.cos(angle)*withdraw)
      direction.set(Math.sin(angle)*.91,.57,Math.cos(angle)*.91).normalize();group.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction)
    }
    root.updateMatrixWorld(true)
  }
  pose(0,0)
  const primary=diners[0]!
  return {root,subject,table,plate,food,diners,primary,targets:[primary,primary,primary],roots:[primary,primary,primary],anchors:[[-.1,1.02,.03],[-.1,1.02,.03],[-.1,1.02,.03]] as [number,number,number][],pose,dispose:()=>{}}
}
