import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

// Original flat bamboo-strip approximation; no shrine names, sacred inscription or replica.
export function createJapaneseKumadeModel(){
 const root=new THREE.Group();root.name='japanese-kumade-root'
 const subject=new THREE.Group();subject.name='japanese-kumade-subject';root.add(subject)
 const bambooFace=new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.48,clearcoat:.28,clearcoatRoughness:.32,specularIntensity:.62,vertexColors:true})
 const bambooSide=new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.68,clearcoat:.16,clearcoatRoughness:.44,specularIntensity:.48,vertexColors:true})
 const woodHoriz=new THREE.MeshPhysicalMaterial({color:0xa47148,roughness:.68,clearcoat:.12,clearcoatRoughness:.46,specularIntensity:.48})
 const woodVert=new THREE.MeshPhysicalMaterial({color:0x94633e,roughness:.68,clearcoat:.12,clearcoatRoughness:.46,specularIntensity:.48})
 const woodShelf=new THREE.MeshPhysicalMaterial({color:0xb58357,roughness:.70,clearcoat:.10,clearcoatRoughness:.48,specularIntensity:.46})
 const red=new THREE.MeshPhysicalMaterial({color:0xaa4f3d,roughness:.54,clearcoat:.26,clearcoatRoughness:.32,specularIntensity:.56})
 const gold=new THREE.MeshStandardMaterial({color:0xe8ba50,roughness:.38,metalness:.35}),edge=new THREE.MeshStandardMaterial({color:0xa7782d,roughness:.58,metalness:.2})
 applyCraftSurface(bambooFace,{kind:'bamboo',strength:.56,scale:.80,axis:'y'})
 applyCraftSurface(bambooSide,{kind:'bamboo',strength:.48,scale:.80,axis:'y'})
 applyCraftSurface(woodHoriz,{kind:'wood',strength:.62,scale:.68,axis:'x'})
 applyCraftSurface(woodVert,{kind:'wood',strength:.62,scale:.70,axis:'y'})
 applyCraftSurface(woodShelf,{kind:'wood',strength:.58,scale:.72,axis:'x'})
 applyCraftSurface(red,{kind:'wood',strength:.28,scale:.75,axis:'x'})
 const mesh=(parent:THREE.Object3D,name:string,g:THREE.BufferGeometry,mat:THREE.Material|THREE.Material[],x=0,y=0,z=0)=>{const m=new THREE.Mesh(g,mat);m.name=name;m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m}
 const box=(name:string,w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.Material=woodHoriz,bevel=.014)=>mesh(subject,name,new RoundedBoxGeometry(w,h,d,2,Math.min(bevel,w/3,h/3,d/3)),mat,x,y,z)
 // Chamfered timber holder and preparation stand grounded directly on the courtyard.
 box('kumade-holder-plinth',1.34,.06,.84,.65,-.07,.03,woodHoriz,.014)
 box('kumade-holder-base',1.25,.22,.75,.65,.01,.03,woodShelf,.016)
 box('kumade-holder-left',.10,.40,.26,.54,.32,.03,woodVert,.014)
 box('kumade-holder-right',.10,.40,.26,.76,.32,.03,woodVert,.014)
 box('kumade-holder-front',.12,.40,.10,.65,.32,.11,woodVert,.012)
 box('kumade-holder-back',.12,.40,.10,.65,.32,-.05,woodVert,.012)
 box('kumade-preparation-plinth',1.52,.055,.56,-1.20,-.0725,0,woodVert,.014)
 box('kumade-preparation-foot',1.45,.15,.50,-1.20,-.025,0,woodHoriz,.016)
 box('kumade-preparation-panel',1.45,.70,.08,-1.20,.40,0,woodHoriz,.012)
 box('kumade-preparation-shelf',1.45,.04,.20,-1.20,.21,.09,woodShelf,.008)
 box('kumade-preparation-trim',1.45,.06,.08,-1.20,.78,0,red,.012)
 // Seven separated prongs join a broad central hub and long handle in one closed outline.
 const rake=new THREE.Shape();rake.moveTo(-.06,.12);rake.lineTo(-.06,.82);rake.lineTo(-.33,.96);rake.lineTo(-.33,1.05)
 for(let i=-3;i<=3;i++){const x=i*.30,y=2.40-Math.abs(i)*.08;rake.lineTo(x-.03,y);rake.quadraticCurveTo(x-.03,y+.04,x,y+.04);rake.quadraticCurveTo(x+.03,y+.04,x+.03,y);rake.lineTo(i*.10+.03,1.05);if(i<3)rake.lineTo((i+1)*.10-.03,1.05)}
 rake.lineTo(.33,.96);rake.lineTo(.06,.82);rake.lineTo(.06,.12);rake.closePath()
 const rakeGeo=new THREE.ExtrudeGeometry(rake,{depth:.06,bevelEnabled:false,steps:1,curveSegments:10})
 {
  const pos=rakeGeo.getAttribute('position'),norm=rakeGeo.getAttribute('normal'),colors=new Float32Array(pos.count*3)
  const handleTone=new THREE.Color(0xc49a51),hubTone=new THREE.Color(0xb68943),tineBase=new THREE.Color(0xd7b165),tineTip=new THREE.Color(0xead08a),sideTint=new THREE.Color(0xb18847),c=new THREE.Color()
  for(let i=0;i<pos.count;i++){
   const px=pos.getX(i),py=pos.getY(i),nz=Math.abs(norm.getZ(i))
   if(nz<.5){
    c.copy(sideTint).lerp(tineBase,THREE.MathUtils.clamp((py-.12)/2.32,0,1)*.52)
   }else if(py<=1.06){
    const h=THREE.MathUtils.clamp((py-.12)/.94,0,1)
    c.copy(handleTone).lerp(hubTone,Math.sin(h*Math.PI)*.55)
   }else{
    const t=THREE.MathUtils.clamp((py-1.05)/1.39,0,1)
    const tineId=Math.round(px/Math.max(.10,.10+.20*t))
    c.copy(tineBase).lerp(tineTip,t*.80)
    c.multiplyScalar(1+(tineId%2===0?.035:-.045))
   }
   colors[i*3]=Math.min(1,c.r);colors[i*3+1]=Math.min(1,c.g);colors[i*3+2]=Math.min(1,c.b)
  }
  rakeGeo.setAttribute('color',new THREE.BufferAttribute(colors,3))
 }
 mesh(subject,'kumade-bamboo-body',rakeGeo,[bambooFace,bambooSide],.65)
 // Flat bottom supports the prepared paper badge on its shelf; front/back are actual surfaces.
 const oval=new THREE.Shape();oval.moveTo(-.055,-.20);oval.bezierCurveTo(-.18,-.18,-.18,.17,-.07,.21);oval.bezierCurveTo(-.03,.235,.03,.235,.07,.21);oval.bezierCurveTo(.18,.17,.18,-.18,.055,-.20);oval.closePath()
 const geometry=new THREE.ExtrudeGeometry(oval,{depth:.035,bevelEnabled:false,steps:1,curveSegments:16})
 const tags=[0,1,2].map(i=>{const tag=new THREE.Group();tag.name='kumade-tag-'+i;mesh(tag,'kumade-tag-surface-'+i,geometry,[gold,edge]);subject.add(tag);return tag})
 const initial=[[-1.65,.43,.04],[-1.20,.43,.04],[-.75,.43,.04]]as const,goals=[[.24,1.68,.06],[1.06,1.68,.06],[.65,1,.06]]as const
 function pose(step:number,n:number){const s=THREE.MathUtils.clamp(Math.floor(step),0,3),t=THREE.MathUtils.clamp(n,0,1);tags.forEach((tag,i)=>{const a=initial[i]!,b=goals[i]!;if(i<s||i===s&&t===1)tag.position.set(b[0],b[1],b[2]);else if(i!==s||t===0)tag.position.set(a[0],a[1],a[2]);else{const points=[a,[a[0],2.75,.55],[b[0],2.75,.55],b],k=t<.25?0:t<.75?1:2,u=k===0?t*4:k===1?(t-.25)*2:(t-.75)*4,p=points[k]!,q=points[k+1]!;tag.position.set(p[0]!+(q[0]!-p[0]!)*u,p[1]!+(q[1]!-p[1]!)*u,p[2]!+(q[2]!-p[2]!)*u)}});root.updateMatrixWorld(true)}
 pose(0,0)
 return{root,subject,tags,targets:tags,roots:tags,anchors:[[0,0,.035],[0,0,.035],[0,0,.035]]as[number,number,number][],pose}
}
