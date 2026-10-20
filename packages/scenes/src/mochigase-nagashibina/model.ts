import * as THREE from 'three'
import { createStylizedWater } from '@wbr/scene-runtime/stylized-water'

// Original low relief paper figures and a round straw sandawara. No boat hull.
export function createNagashibinaModel() {
  const root=new THREE.Group();root.name='nagashibina-root'
  const subject=new THREE.Group();subject.name='nagashibina-subject';root.add(subject)
  const tray=new THREE.Group();tray.name='nagashibina-tray';subject.add(tray)
  const mat=(color:string,roughness=.88)=>new THREE.MeshStandardMaterial({color,roughness,metalness:0})
  const straw=mat('#c5a15b'),strand=mat('#e1c780'),edge=mat('#ac884c'),paper=mat('#fff0d6'),blue=mat('#647e95'),coral=mat('#c87871'),ink=mat('#3e4746'),pink=mat('#e9a4ae'),wood=mat('#80664d'),sweet=mat('#d9dfb3'),bank=mat('#b8b89a')
  const mesh=(name:string,g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D=tray)=>{const o=new THREE.Mesh(g,m);o.name=name;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
  const rod=(name:string,a:THREE.Vector3,b:THREE.Vector3,r:number,m:THREE.Material,parent:THREE.Object3D=tray)=>{const d=b.clone().sub(a),o=mesh(name,new THREE.CylinderGeometry(r,r,d.length(),8),m,parent);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return o}
  const base=mesh('round-straw-base',new THREE.CylinderGeometry(.58,.58,.06,64),straw);base.position.y=.03
  // Parallel bundles woven across the disc, with thin cross ties kept on its top.
  for(let i=-7;i<=7;i++){const x=i*.071,len=Math.sqrt(.555*.555-x*x);rod('straw-bundle-'+i,new THREE.Vector3(x,.067,-len),new THREE.Vector3(x,.067,len),.009,strand)}
  for(let i=-5;i<=5;i++){const z=i*.094,len=Math.sqrt(.55*.55-z*z);rod('straw-tie-'+i,new THREE.Vector3(-len,.079,z),new THREE.Vector3(len,.079,z),.005,edge)}
  const rim=mesh('straw-bound-rim',new THREE.TorusGeometry(.565,.023,8,64),strand);rim.rotation.x=Math.PI/2;rim.position.y=.060
  const paperFigure=(name:string,x:number,m:THREE.Material)=>{
    const group=new THREE.Group();group.name=name;group.position.set(x,.075,-.12);tray.add(group)
    const silhouette=new THREE.Shape();silhouette.moveTo(-.215,0);silhouette.lineTo(-.16,.22);silhouette.lineTo(-.075,.34);silhouette.lineTo(.075,.34);silhouette.lineTo(.16,.22);silhouette.lineTo(.215,0);silhouette.closePath()
    const robe=mesh(name+'-folded-paper',new THREE.ExtrudeGeometry(silhouette,{depth:.014,bevelEnabled:false,steps:1}),m,group)
    // A narrow ivory collar is another closed piece of paper resting on the robe.
    const collar=new THREE.Shape();collar.moveTo(-.06,.335);collar.lineTo(0,.25);collar.lineTo(.06,.335);collar.lineTo(.035,.335);collar.lineTo(0,.285);collar.lineTo(-.035,.335);collar.closePath()
    const fold=mesh(name+'-paper-collar',new THREE.ExtrudeGeometry(collar,{depth:.004,bevelEnabled:false}),paper,group);fold.position.z=.014
    const head=mesh(name+'-paper-face',new THREE.CylinderGeometry(.058,.058,.016,32),paper,group);head.rotation.x=Math.PI/2;head.position.set(0,.388,.005)
    const hair=mesh(name+'-hair',new THREE.BoxGeometry(.095,.026,.018),ink,group);hair.position.set(0,.435,.004)
    if(name==='hina-male'){const cap=mesh('hina-male-cap',new THREE.BoxGeometry(.045,.065,.019),ink,group);cap.position.set(0,.474,.003)}
    else {const bun=mesh('hina-female-hair-knot',new THREE.CylinderGeometry(.025,.025,.020,16),ink,group);bun.rotation.x=Math.PI/2;bun.position.set(.060,.422,.004)}
    return {group,robe}
  }
  const figures=[paperFigure('hina-male',-.22,blue),paperFigure('hina-female',.22,coral)]
  // The sweet and branch accompany the pair; their number, colours and layout are not ritual prescriptions.
  const mochi=mesh('diamond-rice-sweet',new THREE.BoxGeometry(.20,.035,.20),sweet);mochi.position.set(-.19,.101,.22);mochi.rotation.y=Math.PI/4
  const stemA=new THREE.Vector3(.11,.088,.34),stemB=new THREE.Vector3(.42,.103,.03)
  rod('peach-branch',stemA,stemB,.012,wood)
  for(const [i,x,z] of [[0,.32,.18],[1,.42,.07],[2,.21,.27]] as const){
    rod('peach-twig-'+i,new THREE.Vector3(.22,.098,.23),new THREE.Vector3(x,.138,z),.006,wood)
    for(let p=0;p<5;p++){const angle=p*Math.PI*2/5,o=mesh('peach-'+i+'-petal-'+p,new THREE.SphereGeometry(.024,12,8),pink);o.scale.set(1,.25,1);o.position.set(x+Math.cos(angle)*.027,.148,z+Math.sin(angle)*.027)}
    const heart=mesh('peach-'+i+'-heart',new THREE.SphereGeometry(.012,12,8),strand);heart.position.set(x,.152,z)
  }
  const shore=mesh('riverbank',new THREE.BoxGeometry(2.1,.32,4.5),bank,root);shore.position.set(-1.26,-.10,0)
  const shoreLip=mesh('bank-stone-edge',new THREE.BoxGeometry(.16,.12,4.5),mat('#c9c6a5'),root);shoreLip.position.set(-.25,0,0)
  const water=createStylizedWater({geometry:new THREE.PlaneGeometry(5.0,4.5).rotateX(-Math.PI/2),normal:'y',depth:.22,color:'#7fc6bb',bedColor:'#afc4a2',opacity:.56,waveScale:3.5,causticScale:3})
  water.surface.position.set(1.65,0,0);root.add(water.surface)
  const pose=(step:number,amount:number)=>{
    const t=THREE.MathUtils.clamp(Number.isFinite(amount)?amount:0,0,1)
    tray.position.set(-.9,.06,0)
    if(step===0)tray.position.y=THREE.MathUtils.lerp(.06,.60,t)
    else if(step===1)tray.position.set(THREE.MathUtils.lerp(-.9,.48,t),.60,0)
    else if(step===2){const lower=Math.min(1,t/.6),drift=Math.max(0,(t-.6)/.4);tray.position.set(.48+.57*drift,THREE.MathUtils.lerp(.60,-.012,lower),-.40*drift)}
    else if(step>=3)tray.position.set(1.05,-.012,-.40)
    root.updateMatrixWorld(true)
  }
  pose(0,0)
  return {root,subject,tray,base,figures,water,targets:[tray,tray,tray],roots:[tray,tray,tray],anchors:[[0,.075,.37],[0,.075,.37],[0,.075,.37]] as [number,number,number][],pose,update:(dt:number,reduced=false)=>water.update(dt,reduced),dispose:()=>water.dispose()}
}
