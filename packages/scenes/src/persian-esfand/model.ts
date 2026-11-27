import { getEnvironmentSurfaceY } from '@wbr/scene-runtime'
import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { bakeCreviceAO } from '@wbr/scene-runtime/prop-geometry'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { addContactShadow, addObjectCradle, addOfferingTable } from '../cozy-furniture'

const V=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z)
function panGeometry(){return new THREE.LatheGeometry([[0,0],[.285,0],[.32,.025],[.335,.12],[.315,.12],[.299,.03],[.28,.022],[0,.022]].map(([x,y])=>new THREE.Vector2(x!,y!)),64)}
function dedupeNames(root:THREE.Object3D){
 const seen=new Map<string,number>()
 root.traverse(o=>{const n=seen.get(o.name)??0;seen.set(o.name,n+1);if(n>0)o.name=`${o.name}-${n}`})
}

/** A filled household pan, a single stove and a real cloth; smoke is an explicitly separate effect. */
export function createEsfandModel(){
 const root=new THREE.Group();root.name='esfand-subject';const subject=root
 const GROUND_Y=getEnvironmentSurfaceY('persian-esfand')
 const metal=new THREE.MeshStandardMaterial({color:0x535e64,metalness:.55,roughness:.4}),panMetal=new THREE.MeshStandardMaterial({color:0x535e64,metalness:.55,roughness:.4,vertexColors:true}),burnerMat=new THREE.MeshStandardMaterial({color:0x363a3e,metalness:.38,roughness:.72}),wood=new THREE.MeshStandardMaterial({color:0xc39558,roughness:.88}),drawerWood=new THREE.MeshStandardMaterial({color:0x8c603c,roughness:.82}),shelfWood=new THREE.MeshStandardMaterial({color:0x966943,roughness:.83}),stainless=new THREE.MeshStandardMaterial({color:0xc1c8c5,metalness:.6,roughness:.4}),black=new THREE.MeshStandardMaterial({color:0x34383c,roughness:.86})
 for(const cookware of[metal,panMetal,burnerMat,stainless])applyCraftSurface(cookware,{kind:'metal',strength:.45})
 applyCraftSurface(wood,{kind:'wood',strength:.4,axis:'z'})
 applyCraftSurface(drawerWood,{kind:'wood',strength:.38,axis:'x'})
 applyCraftSurface(shelfWood,{kind:'wood',strength:.38,axis:'x'})
 const make=(name:string,g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D=root)=>{const o=new THREE.Mesh(g,m);o.name=name;o.castShadow=o.receiveShadow=true;parent.add(o);return o}
 // Village-harmonious chamfered warm timber hearth table + stone hearth top pad (product staging only).
 const hearthTable=addOfferingTable(root,{
  name:'esfand-hearth-table',
  topName:'esfand-hearth-table-top',
  width:2.40,
  depth:1.96,
  surfaceY:.665,
  thickness:.075,
  center:[0,.12],
  groundY:GROUND_Y,
  finish:'chestnut',
  color:0xa47449,
  frameColor:0x7b5436,
  planks:3,
  breadboardEnds:true,
  legThickness:.13,
  legInset:.11,
  apron:true,
  stretchers:true,
  bevel:.016,
 })
 const cabinet=hearthTable.root
 // Add a slatted lower timber shelf resting cleanly on the hearth table's side stretchers.
 const underside=.665-GROUND_Y-.075
 const shelfY=GROUND_Y+Math.max(.036+.018,underside*.28)+.044
 for(let i=0;i<3;i++){
  const slat=make(`esfand-hearth-shelf-${i}`,new RoundedBoxGeometry(2.04,.028,.40,2,.008),shelfWood,cabinet)
  slat.position.set(0,shelfY-GROUND_Y,(i-1)*.46)
 }
 dedupeNames(hearthTable.root)
 const hearthPad=addObjectCradle(root,{
  name:'esfand-counter',
  topName:'esfand-counter',
  width:2.28,
  depth:1.84,
  center:[0,.12],
  groundY:.665,
  surfaceY:.72,
  style:'pad',
  kind:'stone',
  color:0xd1c3aa,
  bevel:.014,
  roughness:.90,
  surfaceScale:.92,
  surfaceStrength:.42,
 })
 dedupeNames(hearthPad.root)
 const counter=hearthPad.top
 // Recessed warm timber apron drawer face + brushed pull bar seated flush against the front apron.
 const door=make('esfand-cabinet-inset',new RoundedBoxGeometry(1.40,.098,.022,2,.006),drawerWood);door.position.set(0,.53,.9685)
 const rail=make('esfand-cabinet-pull',new THREE.CylinderGeometry(.015,.015,.28,12),stainless);rail.rotation.z=Math.PI/2;rail.position.set(0,.53,.9945)
 for(const side of[-1,1]as const){
  const post=make(`esfand-cabinet-pull-mount-${side<0?'l':'r'}`,new THREE.CylinderGeometry(.010,.010,.018,10),stainless)
  post.rotation.x=Math.PI/2;post.position.set(side*.105,.53,.9855)
 }
 const stove=make('esfand-stove',new RoundedBoxGeometry(.81,.08,.72,2,.012),stainless);stove.position.set(.48,.76,-.18)
 const burner=make('esfand-burner',new THREE.CylinderGeometry(.26,.26,.025,48),burnerMat);burner.position.set(.48,.8125,-.18)
 const burnerGlowMat=new THREE.MeshStandardMaterial({color:0x5c2210,emissive:0xff5518,emissiveIntensity:0,roughness:.85})
 const burnerGlow=make('esfand-burner-glow',new THREE.TorusGeometry(.252,.006,8,48),burnerGlowMat,root)
 burnerGlow.rotation.x=Math.PI/2;burnerGlow.position.set(.48,.818,-.18);burnerGlow.castShadow=burnerGlow.receiveShadow=false
 burnerGlow.userData.effect=true;burnerGlow.userData.toonSurface={outline:false}
 const dial=make('esfand-stove-dial',new THREE.CylinderGeometry(.055,.055,.035,24),black);dial.rotation.x=Math.PI/2;dial.position.set(.72,.78,.1975)
 const pan=new THREE.Group();pan.name='esfand-pan-root';root.add(pan)
 const bowl=make('esfand-pan',bakeCreviceAO(panGeometry(),{groundY:0,groundRange:.035,cavityCenter:[0,0],cavityRadius:.315,cavityTopY:.12,strength:.38}),panMetal,pan)
 const neck=make('esfand-pan-neck',new THREE.BoxGeometry(.11,.035,.19),metal,pan);neck.position.set(0,.08,.40)
 const grip=make('esfand-grip',new THREE.BoxGeometry(.24,.075,.34),wood,pan);grip.position.set(0,.09,.65)
 const seedMaterial=new THREE.MeshStandardMaterial({color:0x483426,roughness:1})
 const seeds:THREE.Mesh[]=[]
 for(let i=0;i<21;i++){const a=i*2.399963229728653,r=.205*Math.sqrt((i+.5)/21),g=new THREE.IcosahedronGeometry(.022,0);g.scale(1,.65,.8);g.computeBoundingBox();const o=make('esfand-seed-'+i,g,seedMaterial,pan);o.position.set(r*Math.cos(a),.022-g.boundingBox!.min.y,r*Math.sin(a));seeds.push(o)}
 const clothRoot=new THREE.Group();clothRoot.name='esfand-cloth-root';root.add(clothRoot)
 const clothGeometry=new THREE.BoxGeometry(.48,.018,.36,16,1,12),pos=clothGeometry.getAttribute('position'),colors:number[]=[]
 for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);pos.setY(i,pos.getY(i)+.008*Math.cos(x/.48*Math.PI*4));const border=Math.abs(x)>.203||Math.abs(z)>.146;const c=new THREE.Color(border?0x3c7f83:0xf4dfb1);colors.push(c.r,c.g,c.b)}
 clothGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));clothGeometry.computeVertexNormals();clothGeometry.computeBoundingBox()
 const cloth=make('esfand-cloth',clothGeometry,applyCraftSurface(new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}),{kind:'fabric',strength:.34}),clothRoot)
 const home=V(-.46,.72,.06),lifted=home.clone().add(V(0,.34,0)),heated=V(.48,.825,-.18),clothHome=V(.85,.72-clothGeometry.boundingBox!.min.y,.81)
 addContactShadow(root,{name:'esfand-stove-contact-ao',width:.90,depth:.80,y:.7218,center:[.48,-.18],shape:'rounded-rect',opacity:.24})
 const panShadow=addContactShadow(root,{name:'esfand-pan-contact-ao',width:.74,depth:.74,y:.7218,center:[-.46,.06],shape:'ellipse',opacity:.22})
 const clothShadow=addContactShadow(root,{name:'esfand-cloth-contact-ao',width:.54,depth:.42,y:.7218,center:[.85,.81],shape:'rounded-rect',opacity:.20})
 const smoke=new THREE.Group();smoke.name='esfand-smoke-effect';smoke.userData.effect=true;root.add(smoke)
 const uniforms={time:{value:0},spread:{value:0}}
 const smokeMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms,vertexShader:'varying vec2 uv0;uniform float time;uniform float spread;void main(){uv0=uv;vec3 p=position;p.x+=sin(uv.y*7.0+time)*0.025*uv.y-spread*uv.y*.24;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}',fragmentShader:'varying vec2 uv0;uniform float spread;void main(){float x=(uv0.x-.5)*2.0;float y=uv0.y;float alpha=exp(-x*x*7.0)*smoothstep(0.0,.2,y)*(1.0-smoothstep(.45,1.0,y))*.06;gl_FragColor=vec4(.91,.94,.91,alpha*(1.0-spread*.28));}'})
 const smokeBase=new THREE.Mesh(new THREE.PlaneGeometry(.34,.68,12,20),smokeMaterial);smokeBase.name='esfand-smoke-wisp-0';smokeBase.position.set(0,.34,0);smokeBase.userData.effect=true;smokeBase.userData.toonSurface={outline:false};smokeBase.raycast=()=>{};smoke.add(smokeBase)
 function pose(checkpoint:number,amount:number){
  if(checkpoint<3&&amount>=1){pose(checkpoint+1,0);return}
  const t=THREE.MathUtils.clamp(Number.isFinite(amount)?amount:0,0,1)
  pan.position.copy(home);clothRoot.position.copy(clothHome);clothRoot.rotation.set(0,0,0);smoke.visible=burnerGlow.visible=checkpoint>=2;uniforms.spread.value=checkpoint>=3?1:0
  burnerGlowMat.emissiveIntensity=checkpoint>=2?1.45:0
  if(checkpoint===0)pan.position.lerp(lifted,t)
  else if(checkpoint===1){const over=heated.clone().add(V(0,.34,0));if(t<.65)pan.position.copy(lifted).lerp(over,t/.65);else pan.position.copy(over).lerp(heated,(t-.65)/.35)}
  else pan.position.copy(heated)
  if(checkpoint===2){
   const raised=V(.85,1.43,.81),high=V(.85,1.43,.4),u=t<.25?t/.25:t>.75?(1-t)/.25:1
   // Lift outside the wooden handle before bringing the cloth beside the rising smoke.
   if(u<.5)clothRoot.position.copy(clothHome).lerp(raised,u*2);else clothRoot.position.copy(raised).lerp(high,(u-.5)*2)
   clothRoot.rotation.x=-Math.PI/2*Math.min(1,u*2)
   if(t>=.25&&t<=.75){const wave=Math.sin((t-.25)/.5*Math.PI);clothRoot.position.x-=.7*wave;clothRoot.rotation.z=-.22*wave}
   uniforms.spread.value=(1-Math.cos(Math.PI*Math.min(1,t/.75)))/2
  }
  ;(panShadow.material as THREE.MeshBasicMaterial).opacity=.22*THREE.MathUtils.clamp(1-pan.position.distanceTo(home)*3.2,0,1)
  ;(clothShadow.material as THREE.MeshBasicMaterial).opacity=.20*THREE.MathUtils.clamp(1-clothRoot.position.distanceTo(clothHome)*3.5,0,1)
  smoke.position.copy(heated).add(V(-.015,.045,0));seedMaterial.color.setHex(checkpoint>=2?0x282c2d:0x483426);root.updateMatrixWorld(true)
 }
 pose(0,0)
 return{root,subject,cabinet,counter,door,rail,stove,burner,dial,pan,bowl,neck,grip,seeds,cloth,clothRoot,home,lifted,heated,clothHome,smoke,smokeUniforms:uniforms,pose,tick:(dt:number)=>{uniforms.time.value+=dt;if(burnerGlow.visible)burnerGlowMat.emissiveIntensity=1.45+.22*Math.sin(uniforms.time.value*2.6)},targets:[grip,grip,cloth],roots:[pan,pan,clothRoot],anchors:[V(0,.0375,0),V(0,.0375,0),V(0,.017,0)]}
}
