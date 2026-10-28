import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import * as THREE from 'three'

// A finite kagami-biraki fragment. Lid partition, sliding and mallet return are product staging.
export function createKagamiBirakiModel(){
 const root=new THREE.Group();root.name='kagami-biraki-root';root.position.y=-.012
 const subject=new THREE.Group();subject.name='kagami-biraki-subject';root.add(subject)
 const mat=(color:string,roughness=.75)=>new THREE.MeshStandardMaterial({color,roughness,metalness:0})
 const cedar=mat('#b68a55'),lidWood=mat('#e2bf86'),malletWood=mat('#c3955c'),rope=mat('#a78b55'),red=mat('#bb4841',.78),white=mat('#f8ebd2',.85)
 const straw=mat('#d5ba7e',.95)
 const pixels=new Uint8Array(32*32*4)
 for(let y=0;y<32;y++)for(let x=0;x<32;x++){const v=(x%8<2?-.10:.04)+(y%8<2?-.07:0)+.025*Math.sin(x*13+y*7),i=(y*32+x)*4,value=Math.round(255*THREE.MathUtils.clamp(.92+v,0,1));pixels[i]=value;pixels[i+1]=value;pixels[i+2]=value;pixels[i+3]=255}
 const weave=new THREE.DataTexture(pixels,32,32);weave.wrapS=weave.wrapT=THREE.RepeatWrapping;weave.repeat.set(12,4);weave.colorSpace=THREE.SRGBColorSpace;weave.needsUpdate=true;straw.map=weave
 const finish=(source:THREE.BufferGeometry)=>{
  const raw=source.index?source.toNonIndexed():source,p=raw.getAttribute('position'),uv=raw.getAttribute('uv'),faces:number[]=[],tex:number[]=[]
  for(let i=0;i<p.count;i+=3){const v=[0,1,2].map(n=>new THREE.Vector3().fromBufferAttribute(p,i+n));if(new THREE.Triangle(v[0]!,v[1]!,v[2]!).getArea()>1e-12){v.forEach(q=>faces.push(q.x,q.y,q.z));if(uv)for(let n=0;n<3;n++)tex.push(uv.getX(i+n),uv.getY(i+n))}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(faces,3));if(uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(tex,2));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();if(raw!==source)raw.dispose();source.dispose();return g
 }
 const mesh=(name:string,geometry:THREE.BufferGeometry,material:THREE.Material,parent:THREE.Object3D)=>{const o=new THREE.Mesh(finish(geometry),material);o.name=name;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
 const lathe=(points:number[][])=>new THREE.LatheGeometry(points.map(p=>new THREE.Vector2(p[0]!,p[1]!)),64)
 const cask=new THREE.Group();cask.name='prepared-sake-cask';cask.position.x=.35;subject.add(cask)
 const barrel=mesh('cedar-barrel',lathe([[0,0],[.55,0],[.62,.06],[.65,.5],[.62,1.08],[.53,1.08],[.55,.5],[.50,.12],[0,.12]]),cedar,cask)
 const radius=(y:number)=>y<=.5?.62+.03*(y-.06)/.44:.65-.03*(y-.5)/.58
 const wrap=mesh('woven-komo-wrap',lathe([[radius(.08),.08],[radius(.08)+.035,.08],[.685,.5],[radius(.99)+.035,.99],[radius(.99),.99],[.65,.5],[radius(.08),.08]]),straw,cask)
 for(const y of[.20,.91]){const hoop=mesh('rope-hoop-'+y,new THREE.TorusGeometry(radius(y)+.035+.018,.018,8,64),rope,cask);hoop.rotation.x=Math.PI/2;hoop.position.y=y}
 const liquidRadius=.55-(.03*(.83-.5)/.58)
 const liquidMaterial=createRitualMaterial({color:'#ead59b',roughness:.18,transparent:true,opacity:.78,metalness:0,depthWrite:false},{kind:'water',strength:.25})
 const liquid=mesh('sake-volume',lathe([[0,.12],[.50,.12],[.55,.5],[liquidRadius,.83],[0,.83]]),liquidMaterial,cask);liquid.castShadow=false
 // Both prepared halves stay flat on the rim; this opening geometry is an original simplification.
 const lids=[-1,1].map(side=>{const points=Array.from({length:49},(_,i)=>{const angle=-Math.PI/2+Math.PI*i/48;return new THREE.Vector2(side*.61*Math.cos(angle),.61*Math.sin(angle))});if(side===-1)points.reverse();const s=new THREE.Shape(points);s.closePath();const o=mesh('prepared-lid-'+(side===-1?'left':'right'),new THREE.ExtrudeGeometry(s,{depth:.045,bevelEnabled:false,curveSegments:24}),lidWood,cask);o.rotation.x=-Math.PI/2;o.position.y=1.08;return o})
 const mallet=new THREE.Group();mallet.name='wooden-mallet';subject.add(mallet)
 const head=mesh('mallet-head',new THREE.BoxGeometry(.50,.22,.26),malletWood,mallet)
 const handle=mesh('mallet-handle',new THREE.CylinderGeometry(.035,.035,.82,16),cedar,mallet);handle.rotation.x=Math.PI/2;handle.position.set(0,-.035,.48)
 for(const [i,material]of[red,white].entries()){const band=mesh('ribbon-band-'+i,new THREE.TorusGeometry(.040,.006,8,32),material,mallet);band.position.set(0,-.035,.22+i*.018)}
 const knot=mesh('ribbon-knot',new THREE.SphereGeometry(.027,12,8).scale(1,.65,1),red,mallet);knot.position.set(0,.014,.23)
 for(const [i,material]of[red,white].entries()){const tail=mesh('ribbon-tail-'+i,new THREE.BoxGeometry(.035,.008,.19),material,mallet);tail.position.set((i===0?-1:1)*.026,.010,.321);tail.rotation.y=(i===0?-1:1)*.22}
 const lerp=THREE.MathUtils.lerp
 const pose=(step:number,amount:number)=>{
  const t=THREE.MathUtils.clamp(Number.isFinite(amount)?amount:0,0,1)
  let opening=step>1?1:step===1?THREE.MathUtils.clamp((t-.4)/.6,0,1):0
  lids.forEach((o,i)=>o.position.x=(i===0?-1:1)*lerp(.002,.15,opening))
  if(step===0){if(t<.5)mallet.position.set(.35,lerp(1.235,1.8,t/.5),0);else mallet.position.set(.35,1.8,lerp(0,.45,(t-.5)/.5))}
  else if(step===1){mallet.position.set(.35,t<.4?lerp(1.8,1.235,t/.4):lerp(1.235,1.65,(t-.4)/.6),.45)}
  else if(step===2){if(t<.25)mallet.position.set(.35,lerp(1.65,1.8,t/.25),.45);else if(t<.75){const u=(t-.25)/.5;mallet.position.set(lerp(.35,-1.1,u),1.8,lerp(.45,.10,u))}else mallet.position.set(-1.1,lerp(1.8,.11,(t-.75)/.25),.10)}
  else mallet.position.set(-1.1,.11,.10)
  root.updateMatrixWorld(true)
 }
 pose(0,0)
 let disposed=false
 return {root,subject,cask,barrel,wrap,liquid,lids,mallet,head,handle,targets:[mallet,mallet,mallet],roots:[mallet,mallet,mallet],anchors:[[0,.11,.04],[0,.11,.04],[0,.11,.04]] as [number,number,number][],pose,dispose:()=>{if(!disposed){disposed=true;weave.dispose()}}}
}
