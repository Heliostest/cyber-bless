import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import * as THREE from 'three'
import { createCanangTrayMaterials } from './canang-material'
import {
 CANANG_FLOWER_PALETTES,
 createCanangLeafMaterial,
 createCanangPetalMaterial,
 createJepunCalyxGeometry,
 createJepunHeartGeometry,
 createJepunPetalGeometry,
 createPandanStripGeometry,
 createPorosanLeafRollGeometry,
} from './floral-detail'

const V=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z)
/** A source-bounded offering, on an original simplified field-shrine support. */
export function createCanangModel(){
 const root=new THREE.Group();root.name='canang-subject'
 const mat=(color:number,roughness=1)=>new THREE.MeshStandardMaterial({color,roughness})
 const trayMats=createCanangTrayMaterials()
 const stone=mat(0xbfc2ac),cap=mat(0xd5d4ba),joint=mat(0x999d85),limeMat=mat(0xfff7de),riceMat=mat(0xfff7de),caneRindMat=mat(0x718f4c),cakeMat=mat(0xe3b87c),bananaMat=mat(0xf1d47d),betelNut=mat(0x947057)
 const petalMat=createCanangPetalMaterial()
 const calyxMat=createCanangLeafMaterial('leaf-pinnate')
 const pandanMat=createCanangLeafMaterial('leaf-parallel')
 const porosanLeafMat=createCanangLeafMaterial('leaf-pinnate')
 ;[stone,cap,joint].forEach(material=>applyCraftSurface(material,{kind:'stone',strength:.45}))
 const make=(name:string,geometry:THREE.BufferGeometry,material:THREE.Material,parent:THREE.Object3D=root)=>{const m=new THREE.Mesh(geometry,material);m.name=name;m.castShadow=m.receiveShadow=true;parent.add(m);return m}
 const box=(name:string,size:[number,number,number],pos:[number,number,number],material:THREE.Material,parent:THREE.Object3D=root)=>{const m=make(name,new THREE.BoxGeometry(...size),material,parent);m.position.set(...pos);return m}
 const solid=(name:string,size:[number,number,number],pos:[number,number,number],material:THREE.Material,parent:THREE.Object3D)=>{const m=make(name,new THREE.IcosahedronGeometry(1,2),material,parent);m.scale.set(...size);m.position.set(...pos);return m}
 box('canang-paving',[3.9,.12,2.9],[0,.06,.15],stone)
 // The offering ledge is supported all the way to the ground; no repeated little table.
 box('canang-shrine-foot',[1.58,.15,1.52],[-.65,.195,-.5],joint)
 box('canang-shrine-plinth',[1.30,.16,1.24],[-.65,.35,-.5],stone)
 box('canang-shrine-body',[1.14,.32,1.08],[-.65,.59,-.5],stone)
 box('canang-shrine-neck',[1.30,.07,1.24],[-.65,.785,-.5],joint)
 box('canang-shrine-ledge',[1.56,.08,1.50],[-.65,.86,-.5],cap)
 for(const side of[-1,1])box('canang-shrine-recess-'+side,[.018,.22,.46],[-.65+side*.574,.59,-.5],joint)
 const tray=new THREE.Group();tray.name='canang-tray';root.add(tray)
 box('canang-ceper-floor',[1.25,.06,1.25],[0,.03,0],trayMats.ceperFloor,tray)
 for(const side of[-1,1]){
  box('canang-ceper-side-x-'+side,[.04,.16,1.25],[side*.605,.10,0],trayMats.ceperWall,tray)
  box('canang-ceper-side-z-'+side,[1.17,.16,.04],[0,.10,side*.605],trayMats.ceperWall,tray)
  for(const n of[-1,0,1])box('canang-leaf-seam-'+side+'-'+n,[.012,.006,1.17],[n*.31,.063,side*.003],trayMats.leafSeam,tray)
 }
 // Narrow woven ribs are attached to the rim rather than floating above it.
 for(const x of[-.48,-.24,0,.24,.48])for(const z of[-.628,.628])box('canang-rim-stitch-'+x+'-'+z,[.025,.08,.009],[x,.125,z],trayMats.rimStitch,tray)
 const sampiyan=make('canang-sampiyan',new THREE.CylinderGeometry(.49,.49,.025,32),trayMats.sampiyanDisk,tray);sampiyan.position.set(0,.075,-.08)
 for(let i=0;i<12;i++){const a=i*Math.PI/6,m=box('canang-sampiyan-weave-'+i,[.073,.009,.44],[Math.sin(a)*.245,.092,Math.cos(a)*.245-.08],i%2?trayMats.sampiyanStripBud:trayMats.sampiyanStripLight,tray);m.rotation.y=a}
 const porosan=new THREE.Group();porosan.name='canang-porosan';tray.add(porosan);porosan.position.set(-.45,.065,.22)
 const wrap=make('canang-porosan-leaf',createPorosanLeafRollGeometry(),porosanLeafMat,porosan);wrap.rotation.y=.3
 solid('canang-betel-nut',[.025,.025,.028],[.014,.115,.018],betelNut,porosan)
 solid('canang-lime',[.018,.012,.02],[-.015,.112,-.025],limeMat,porosan)
 const cane=make('canang-sugarcane',new THREE.CylinderGeometry(.09,.09,.065,16),bananaMat,tray);cane.position.set(-.32,.0925,.44)
 const caneEdge=make('canang-sugarcane-rind',new THREE.TorusGeometry(.084,.008,6,24),caneRindMat,tray);caneEdge.rotation.x=Math.PI/2;caneEdge.position.set(-.32,.125,.44)
 const banana=solid('canang-banana',[.16,.045,.065],[0,.105,.44],bananaMat,tray);banana.rotation.y=-.15
 box('canang-cake',[.16,.075,.13],[.31,.0975,.44],cakeMat,tray)
 const coinMat=mat(0xc5a767,.45);coinMat.metalness=.45;applyCraftSurface(coinMat,{kind:'metal',strength:.45})
 const coin=make('canang-coin',new THREE.CylinderGeometry(.037,.037,.012,20),coinMat,tray);coin.position.set(.48,.066,.38)
 for(let i=0;i<5;i++){const m=solid('canang-rice-'+i,[.012,.007,.023],[.15+i%3*.022,.067,.36+Math.floor(i/3)*.03],riceMat,tray);m.rotation.y=i*.6}
 for(const x of[.51,.55])box('canang-incense-'+x,[.012,.014,.86],[x,.067,-.06],trayMats.incenseStick,tray)
 const calyxGeo=createJepunCalyxGeometry()
 function flower(name:string,hue:'white'|'red'|'yellow'|'blue',x:number,z:number,spinOffset=0){
  const f=new THREE.Group();f.name=name;tray.add(f);f.position.set(x,.096,z)
  const palette=CANANG_FLOWER_PALETTES[hue]
  const petalGeo=createJepunPetalGeometry(palette)
  const heartGeo=createJepunHeartGeometry(palette)
  make(name+'-calyx',calyxGeo,calyxMat,f)
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5+spinOffset,m=make(name+'-petal-'+i,petalGeo,petalMat,f);m.rotation.y=a}
  make(name+'-heart',heartGeo,petalMat,f);return f
 }
 const flowerWhite=flower('canang-white-flower','white',.29,-.08,.12)
 flower('canang-red-flower','red',0,.21,.42);flower('canang-yellow-flower','yellow',-.29,-.08,-.22);flower('canang-blue-flower','blue',0,-.37,.28)
 const pandanGroup=new THREE.Group();pandanGroup.name='canang-pandan';tray.add(pandanGroup);pandanGroup.position.set(0,.0955,-.08)
 for(let i=0;i<7;i++){const a=i*Math.PI*2/7+.15,m=make('canang-pandan-strip-'+i,createPandanStripGeometry(i),pandanMat,pandanGroup);m.position.set(Math.sin(a)*.024,.001+i*.0028,Math.cos(a)*.024);m.rotation.y=a}
 const rest=V(.82,.12,.80),lift=V(.82,1.24,.80),hover=V(-.65,1.24,-.50),placed=V(-.65,.90,-.50),flowerRest=V(-.75,.12,1.08),flowerEnd=V(.29,.096,-.08)
 function pose(checkpoint:number,value:number):void{
  const step=THREE.MathUtils.clamp(Math.floor(Number.isFinite(checkpoint)?checkpoint:0),0,3),n=THREE.MathUtils.clamp(Number.isFinite(value)?value:0,0,1)
  if(n===1 && step<3){pose(step+1,0);return}
  tray.position.copy(step<2?rest:step===2?lift:placed)
  if(step===1)tray.position.lerp(lift,n)
  if(step===2){if(n<.65)tray.position.lerp(hover,n/.65);else tray.position.copy(hover).lerp(placed,(n-.65)/.35)}
  flowerWhite.position.copy(flowerEnd)
  if(step===0 && n<1){const world=flowerRest.clone().lerp(rest.clone().add(flowerEnd),n);world.y+=Math.sin(Math.PI*n)*.42;flowerWhite.position.copy(world.sub(tray.position))}
  root.updateMatrixWorld(true)
 }
 pose(0,0)
 return {root,tray,flower:flowerWhite,targets:[flowerWhite,tray,tray],roots:[flowerWhite,tray,tray],anchors:[[0,.05,0],[0,.13,.55],[0,.13,.55]] as [number,number,number][],pose,dispose(){trayMats.dispose()}}
}
