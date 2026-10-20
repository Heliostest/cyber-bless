import * as THREE from 'three'

// A prepared apple slice and honey dish; the return to the plate is product staging.
export function createAppleHoneyModel() {
  const root=new THREE.Group();root.name='apple-honey-root'
  const subject=new THREE.Group();subject.name='apple-honey-subject';root.add(subject)
  const mat=(color:string,roughness=.7)=>new THREE.MeshStandardMaterial({color,roughness,metalness:0})
  const cream=mat('#f7e4a8',.85),red=mat('#bd4738',.55),ceramic=mat('#f8edd2',.46),blue=mat('#83aaa0',.65),wood=mat('#b38a56',.85),brown=mat('#69492e'),green=mat('#65834a')
  const honeyMaterial=new THREE.MeshStandardMaterial({color:'#d79a24',roughness:.24,metalness:.01,transparent:true,opacity:.8})
  const filmMaterial=new THREE.MeshStandardMaterial({color:'#d7941d',roughness:.22,metalness:0,transparent:true,opacity:.78})
  // Remove only mathematically degenerate pole triangles after Float32 conversion.
  const finish=(source:THREE.BufferGeometry)=>{
    const raw=source.index?source.toNonIndexed():source,position=raw.getAttribute('position'),faces:number[]=[]
    for(let i=0;i<position.count;i+=3){const p=[0,1,2].map(n=>new THREE.Vector3().fromBufferAttribute(position,i+n));if(new THREE.Triangle(p[0]!,p[1]!,p[2]!).getArea()>1e-12)p.forEach(v=>faces.push(v.x,v.y,v.z))}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(faces,3));geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();if(raw!==source)raw.dispose();source.dispose();return geo
  }
  const mesh=(name:string,geometry:THREE.BufferGeometry,material:THREE.Material,parent:THREE.Object3D)=>{
    const o=new THREE.Mesh(finish(geometry),material);o.name=name;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o
  }
  const shape=(points:THREE.Vector2[])=>{const s=new THREE.Shape(points);s.closePath();return s}
  const extrude=(points:THREE.Vector2[],depth:number,z:number)=>new THREE.ExtrudeGeometry(shape(points),{depth,bevelEnabled:false,curveSegments:16}).translate(0,0,z)
  const lathe=(points:number[][])=>new THREE.LatheGeometry(points.map(p=>new THREE.Vector2(p[0]!,p[1]!)),64)
  const board=mesh('serving-board',new THREE.CylinderGeometry(1.52,1.49,.16,64).scale(1,1,.72),wood,root);board.position.y=.068
  const plate=mesh('apple-plate',lathe([[0,0],[.60,0],[.66,.025],[.66,.055],[.62,.055],[.59,.04],[0,.04]]),ceramic,root);plate.position.set(-.72,.148,.12)
  const bowl=mesh('honey-dish',lathe([[0,0],[.43,0],[.59,.10],[.62,.28],[.56,.28],[.42,.06],[0,.06]]),blue,root);bowl.position.set(.72,.148,-.04)
  const honeyRadius=.42+.14*(.22-.06)/(.28-.06)
  const honey=mesh('honey-volume',lathe([[0,.06],[.42,.06],[honeyRadius,.22],[0,.22]]),honeyMaterial,root);honey.position.copy(bowl.position);honey.castShadow=false
  const apple=new THREE.Group();apple.name='apple-slice';subject.add(apple)
  const arc=(radius:number)=>Array.from({length:49},(_,i)=>{const angle=Math.PI+Math.PI*i/48;return new THREE.Vector2(radius*Math.cos(angle),.08+radius*Math.sin(angle))})
  const outer=arc(.44),inner=arc(.416)
  const fleshOutline=[...inner,new THREE.Vector2(.25,.135),new THREE.Vector2(0,.06),new THREE.Vector2(-.25,.135)]
  const flesh=mesh('apple-flesh',extrude(fleshOutline,.12,-.06),cream,apple)
  const peel=mesh('apple-red-peel',extrude([...outer,...inner.slice().reverse()],.12,-.06),red,apple)
  for(const side of[-1,1]){
    const s=new THREE.Shape();s.absellipse(side*.115,-.025,.013,.025,0,Math.PI*2,false,side*.3)
    mesh('apple-seed-'+side,new THREE.ExtrudeGeometry(s,{depth:.005,bevelEnabled:false,curveSegments:12}).translate(0,0,.06),brown,apple)
  }
  // At the completed dip the liquid reaches local y=-.232.
  const level=-.232,lower:THREE.Vector2[]=[]
  for(let i=0;i<outer.length-1;i++){const p=outer[i]!,q=outer[i+1]!
    if((p.y>level&&q.y<level)||(p.y<level&&q.y>level))lower.push(p.clone().lerp(q,(level-p.y)/(q.y-p.y)))
    if(q.y<=level)lower.push(q.clone())
  }
  const frontFilm=mesh('honey-film-front',extrude(lower,.006,.06),filmMaterial,apple)
  const backFilm=mesh('honey-film-back',extrude(lower,.006,-.066),filmMaterial,apple)
  const outerFilm=lower.map(p=>new THREE.Vector2(p.x*(.446/.44),.08+(p.y-.08)*(.446/.44)))
  const edgeFilm=mesh('honey-film-peel',extrude([...outerFilm,...lower.slice().reverse()],.12,-.06),filmMaterial,apple)
  const films=[frontFilm,backFilm,edgeFilm];films.forEach(m=>m.castShadow=false)
  const whole=new THREE.Group();whole.name='whole-apple';root.add(whole);whole.position.set(-.83,.418,-.73)
  const appleGeometry=new THREE.SphereGeometry(1,32,20),p=appleGeometry.getAttribute('position')
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),angle=Math.atan2(z,x),theta=Math.acos(THREE.MathUtils.clamp(y,-1,1))
    const r=.25*(1+.035*Math.cos(5*angle))
    p.setXYZ(i,x*r,.29*y-.045*Math.exp(-theta*theta/.10)+.02*Math.exp(-((Math.PI-theta)**2)/.12),z*r)
  }
  const wholeBody=mesh('whole-apple-body',appleGeometry,red,whole)
  const stem=mesh('apple-stem',new THREE.CylinderGeometry(.017,.022,.14,10),brown,whole);stem.position.set(0,.307,0);stem.rotation.z=-.18
  const leafPoints=[new THREE.Vector2(0,0),new THREE.Vector2(.08,.06),new THREE.Vector2(.23,.035),new THREE.Vector2(.12,-.018)]
  const leaf=mesh('apple-leaf',extrude(leafPoints,.008,-.004),green,whole);leaf.position.set(.01,.35,0);leaf.rotation.x=-.7
  const lerp=THREE.MathUtils.lerp
  const pose=(step:number,amount:number)=>{
    const t=THREE.MathUtils.clamp(Number.isFinite(amount)?amount:0,0,1)
    apple.rotation.set(0,0,0)
    if(step===0){
      if(t<.4){const u=t/.4;apple.position.set(-.72,lerp(.248,.95,u),.12);apple.rotation.x=lerp(-Math.PI/2,0,u)}
      else{const u=(t-.4)/.6;apple.position.set(lerp(-.72,.72,u),.95+Math.sin(Math.PI*u)*.05,lerp(.12,-.04,u))}
    }else if(step===1)apple.position.set(.72,lerp(.95,.60,t),-.04)
    else if(step===2){
      if(t<.38)apple.position.set(.72,lerp(.60,1,t/.38),-.04)
      else if(t<.78){const u=(t-.38)/.4;apple.position.set(lerp(.72,-.72,u),1,lerp(-.04,.12,u))}
      else{const u=(t-.78)/.22;apple.position.set(-.72,lerp(1,.254,u),.12);apple.rotation.x=lerp(0,-Math.PI/2,u)}
    }else{apple.position.set(-.72,.254,.12);apple.rotation.x=-Math.PI/2}
    films.forEach(m=>m.visible=step>1||(step===1&&t===1))
    root.updateMatrixWorld(true)
  }
  pose(0,0)
  return {root,subject,apple,flesh,peel,films,whole,wholeBody,board,plate,bowl,honey,targets:[apple,apple,apple],roots:[apple,apple,apple],anchors:[[0,-.13,.06],[0,-.13,.06],[0,-.13,.06]] as [number,number,number][],pose,dispose:()=>{}}
}
