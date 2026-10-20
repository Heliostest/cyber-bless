import * as THREE from 'three'

const V=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z)
function panGeometry(){return new THREE.LatheGeometry([[0,0],[.285,0],[.32,.025],[.335,.12],[.315,.12],[.299,.03],[.28,.022],[0,.022]].map(([x,y])=>new THREE.Vector2(x!,y!)),64)}

/** A filled household pan, a single stove and a real cloth; smoke is an explicitly separate effect. */
export function createEsfandModel(){
 const root=new THREE.Group();root.name='esfand-subject';const subject=root
 const metal=new THREE.MeshStandardMaterial({color:0x535e64,metalness:.55,roughness:.4}),wood=new THREE.MeshStandardMaterial({color:0xc39558,roughness:.88}),tile=new THREE.MeshStandardMaterial({color:0xf0e8d4,roughness:.7}),blue=new THREE.MeshStandardMaterial({color:0x579da0,roughness:.85}),stainless=new THREE.MeshStandardMaterial({color:0xc1c8c5,metalness:.6,roughness:.4}),black=new THREE.MeshStandardMaterial({color:0x34383c,roughness:.86})
 const make=(name:string,g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D=root)=>{const o=new THREE.Mesh(g,m);o.name=name;o.castShadow=o.receiveShadow=true;parent.add(o);return o}
 const cabinet=make('esfand-kitchen-cabinet',new THREE.BoxGeometry(2.18,.66,1.72),blue);cabinet.position.set(0,.33,.12)
 const counter=make('esfand-counter',new THREE.BoxGeometry(2.30,.06,1.84),tile);counter.position.set(0,.69,.12)
 const door=make('esfand-cabinet-inset',new THREE.BoxGeometry(1.98,.48,.015),blue);door.position.set(0,.34,.9875)
 const rail=make('esfand-cabinet-pull',new THREE.CylinderGeometry(.018,.018,.30,12),stainless);rail.rotation.z=Math.PI/2;rail.position.set(0,.46,1.013)
 const stove=make('esfand-stove',new THREE.BoxGeometry(.81,.08,.72),stainless);stove.position.set(.48,.76,-.18)
 const burner=make('esfand-burner',new THREE.CylinderGeometry(.26,.26,.025,48),black);burner.position.set(.48,.8125,-.18)
 const dial=make('esfand-stove-dial',new THREE.CylinderGeometry(.055,.055,.035,24),black);dial.rotation.x=Math.PI/2;dial.position.set(.72,.78,.1975)
 const pan=new THREE.Group();pan.name='esfand-pan-root';root.add(pan)
 const bowl=make('esfand-pan',panGeometry(),metal,pan)
 const neck=make('esfand-pan-neck',new THREE.BoxGeometry(.11,.035,.19),metal,pan);neck.position.set(0,.08,.40)
 const grip=make('esfand-grip',new THREE.BoxGeometry(.24,.075,.34),wood,pan);grip.position.set(0,.09,.65)
 const seedMaterial=new THREE.MeshStandardMaterial({color:0x483426,roughness:1})
 const seeds:THREE.Mesh[]=[]
 for(let i=0;i<21;i++){const a=i*2.399963229728653,r=.205*Math.sqrt((i+.5)/21),g=new THREE.IcosahedronGeometry(.022,0);g.scale(1,.65,.8);g.computeBoundingBox();const o=make('esfand-seed-'+i,g,seedMaterial,pan);o.position.set(r*Math.cos(a),.022-g.boundingBox!.min.y,r*Math.sin(a));seeds.push(o)}
 const clothRoot=new THREE.Group();clothRoot.name='esfand-cloth-root';root.add(clothRoot)
 const clothGeometry=new THREE.BoxGeometry(.48,.018,.36,16,1,12),pos=clothGeometry.getAttribute('position'),colors:number[]=[]
 for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);pos.setY(i,pos.getY(i)+.008*Math.cos(x/.48*Math.PI*4));const border=Math.abs(x)>.203||Math.abs(z)>.146;const c=new THREE.Color(border?0x3c7f83:0xf4dfb1);colors.push(c.r,c.g,c.b)}
 clothGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));clothGeometry.computeVertexNormals();clothGeometry.computeBoundingBox()
 const cloth=make('esfand-cloth',clothGeometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}),clothRoot)
 const home=V(-.46,.72,.06),lifted=home.clone().add(V(0,.34,0)),heated=V(.48,.825,-.18),clothHome=V(.85,.72-clothGeometry.boundingBox!.min.y,.81)
 const smoke=new THREE.Group();smoke.name='esfand-smoke-effect';smoke.userData.effect=true;root.add(smoke)
 const uniforms={time:{value:0},spread:{value:0}}
 const smokeMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms,vertexShader:'varying vec2 uv0;uniform float time;uniform float spread;void main(){uv0=uv;vec3 p=position;p.x+=sin(uv.y*7.0+time)*0.025*uv.y-spread*uv.y*.24;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}',fragmentShader:'varying vec2 uv0;uniform float spread;void main(){float x=(uv0.x-.5)*2.0;float y=uv0.y;float alpha=exp(-x*x*7.0)*smoothstep(0.0,.2,y)*(1.0-smoothstep(.45,1.0,y))*.19;gl_FragColor=vec4(.91,.94,.91,alpha*(1.0-spread*.28));}'})
 for(let i=0;i<3;i++){const s=new THREE.Mesh(new THREE.PlaneGeometry(.34,.68,12,20),smokeMaterial);s.name='esfand-smoke-wisp-'+i;s.position.set((i-1)*.10,.34,(i%2)*.07);s.rotation.y=(i-1)*.42;s.userData.effect=true;smoke.add(s)}
 function pose(checkpoint:number,amount:number){
  if(checkpoint<3&&amount>=1){pose(checkpoint+1,0);return}
  const t=THREE.MathUtils.clamp(Number.isFinite(amount)?amount:0,0,1)
  pan.position.copy(home);clothRoot.position.copy(clothHome);clothRoot.rotation.set(0,0,0);smoke.visible=checkpoint>=2;uniforms.spread.value=checkpoint>=3?1:0
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
  smoke.position.copy(heated).add(V(-.015,.045,0));seedMaterial.color.setHex(checkpoint>=2?0x282c2d:0x483426);root.updateMatrixWorld(true)
 }
 pose(0,0)
 return{root,subject,cabinet,counter,door,rail,stove,burner,dial,pan,bowl,neck,grip,seeds,cloth,clothRoot,home,lifted,heated,clothHome,smoke,pose,tick:(dt:number)=>{uniforms.time.value+=dt},targets:[grip,grip,cloth],roots:[pan,pan,clothRoot],anchors:[V(0,.0375,0),V(0,.0375,0),V(0,.017,0)]}
}
