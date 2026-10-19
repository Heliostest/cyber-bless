import * as THREE from 'three'

const V=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z)
/** A source-bounded offering, on an original simplified field-shrine support. */
export function createCanangModel(){
 const root=new THREE.Group();root.name='canang-subject'
 const mat=(color:number,roughness=1)=>new THREE.MeshStandardMaterial({color,roughness})
 const leaf=mat(0xbacb76,.87),leafEdge=mat(0x879d4f),leafLight=mat(0xdbd69a),stone=mat(0xbfc2ac),cap=mat(0xd5d4ba),joint=mat(0x999d85),white=mat(0xfff7de),red=mat(0xd96174),yellow=mat(0xf0c257),blue=mat(0x7895ce),pandan=mat(0x718f4c),cakeMat=mat(0xe3b87c),bananaMat=mat(0xf1d47d),wood=mat(0x947057)
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
 box('canang-ceper-floor',[1.25,.06,1.25],[0,.03,0],leaf,tray)
 for(const side of[-1,1]){
  box('canang-ceper-side-x-'+side,[.04,.16,1.25],[side*.605,.10,0],leaf,tray)
  box('canang-ceper-side-z-'+side,[1.17,.16,.04],[0,.10,side*.605],leaf,tray)
  for(const n of[-1,0,1])box('canang-leaf-seam-'+side+'-'+n,[.012,.006,1.17],[n*.31,.063,side*.003],leafLight,tray)
 }
 // Narrow woven ribs are attached to the rim rather than floating above it.
 for(const x of[-.48,-.24,0,.24,.48])for(const z of[-.628,.628])box('canang-rim-stitch-'+x+'-'+z,[.025,.08,.009],[x,.125,z],wood,tray)
 const sampiyan=make('canang-sampiyan',new THREE.CylinderGeometry(.49,.49,.025,32),leafLight,tray);sampiyan.position.set(0,.075,-.08)
 for(let i=0;i<12;i++){const a=i*Math.PI/6,m=box('canang-sampiyan-weave-'+i,[.073,.009,.44],[Math.sin(a)*.245,.092,Math.cos(a)*.245-.08],i%2?leaf:leafLight,tray);m.rotation.y=a}
 const porosan=new THREE.Group();porosan.name='canang-porosan';tray.add(porosan);porosan.position.set(-.45,.065,.22)
 const wrap=solid('canang-porosan-leaf',[.07,.06,.115],[0,.055,0],pandan,porosan);wrap.rotation.y=.3
 solid('canang-betel-nut',[.025,.025,.028],[.014,.115,.018],wood,porosan)
 solid('canang-lime',[.018,.012,.02],[-.015,.112,-.025],white,porosan)
 const cane=make('canang-sugarcane',new THREE.CylinderGeometry(.09,.09,.065,16),bananaMat,tray);cane.position.set(-.32,.0925,.44)
 const caneEdge=make('canang-sugarcane-rind',new THREE.TorusGeometry(.084,.008,6,24),pandan,tray);caneEdge.rotation.x=Math.PI/2;caneEdge.position.set(-.32,.125,.44)
 const banana=solid('canang-banana',[.16,.045,.065],[0,.105,.44],bananaMat,tray);banana.rotation.y=-.15
 box('canang-cake',[.16,.075,.13],[.31,.0975,.44],cakeMat,tray)
 const coinMat=mat(0xc5a767,.45);coinMat.metalness=.45
 const coin=make('canang-coin',new THREE.CylinderGeometry(.037,.037,.012,20),coinMat,tray);coin.position.set(.48,.066,.38)
 for(let i=0;i<5;i++){const m=solid('canang-rice-'+i,[.012,.007,.023],[.15+i%3*.022,.067,.36+Math.floor(i/3)*.03],white,tray);m.rotation.y=i*.6}
 for(const x of[.51,.55])box('canang-incense-'+x,[.012,.014,.86],[x,.067,-.06],wood,tray)
 function flower(name:string,color:THREE.Material,x:number,z:number){
  const f=new THREE.Group();f.name=name;tray.add(f);f.position.set(x,.096,z)
  const base=make(name+'-calyx',new THREE.CylinderGeometry(.045,.035,.016,12),leafEdge,f);base.position.y=.008
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5,m=solid(name+'-petal-'+i,[.055,.026,.105],[Math.sin(a)*.07,.04,Math.cos(a)*.07],color,f);m.rotation.y=a;m.rotation.x=.12}
  solid(name+'-heart',[.035,.026,.035],[0,.055,0],yellow,f);return f
 }
 const flowerWhite=flower('canang-white-flower',white,.29,-.08)
 flower('canang-red-flower',red,0,.21);flower('canang-yellow-flower',yellow,-.29,-.08);flower('canang-blue-flower',blue,0,-.37)
 const pandanGroup=new THREE.Group();pandanGroup.name='canang-pandan';tray.add(pandanGroup);pandanGroup.position.set(0,.0955,-.08)
 for(let i=0;i<7;i++){const a=i*Math.PI*2/7,m=box('canang-pandan-strip-'+i,[.022,.014,.16],[Math.sin(a)*.025,.008+i*.003,Math.cos(a)*.025],pandan,pandanGroup);m.rotation.y=a}
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
 return {root,tray,flower:flowerWhite,targets:[flowerWhite,tray,tray],roots:[flowerWhite,tray,tray],anchors:[[0,.05,0],[0,.13,.55],[0,.13,.55]] as [number,number,number][],pose,dispose(){}}
}
