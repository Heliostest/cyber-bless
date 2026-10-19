import * as THREE from 'three'

/** Original calabash; real hollow wall and cut grooves, with assisted held wooden scraper. */
export function createGuiroModel() {
  const subject=new THREE.Group();subject.name='guiro-subject'
  const holder=new THREE.Group();holder.name='guiro-held-body';holder.position.set(-.65,.18,0);subject.add(holder)
  const controls=[[0,0],[.10,.30],[.30,.48],[.65,.61],[.95,.64],[2.3,.58],[2.65,.48],[2.9,.35],[3.15,.28],[3.2,.28]]
  const baseRadiusAt=(y:number)=>{
    y=THREE.MathUtils.clamp(y,0,3.2)
    for(let i=0;i<controls.length-1;i++){const [y0,r0]=controls[i]!,[y1,r1]=controls[i+1]!;if(y<=y1!){const t=(y-y0!)/(y1!-y0!),e=t*t*(3-2*t);return r0!+(r1!-r0!)*e}}
    return .28
  }
  const carvedRadius=(y:number)=>baseRadiusAt(y)-(y>=.75&&y<=2.45?.034*(.5-.5*Math.cos(2*Math.PI*(y-.75)/.085)):0)
  const outerPoints=Array.from({length:601},(_,i)=>new THREE.Vector2(carvedRadius(3.2*i/600),3.2*i/600))
  const innerRadiusAt=(y:number)=>Math.max(0,baseRadiusAt(y)-.065)
  const innerPoints=Array.from({length:301},(_,i)=>{const y=3.2-(3.2-.12)*i/300;return new THREE.Vector2(innerRadiusAt(y),y)})
  const profile=[...outerPoints,...innerPoints,new THREE.Vector2(0,.12),new THREE.Vector2(0,0)]
  const geometry=new THREE.LatheGeometry(profile,64)
  const shellColor=new THREE.Color(0xd5aa62),grooveColor=new THREE.Color(0xb98b47),innerColor=new THREE.Color(0x77633e),rimColor=new THREE.Color(0xf0ddb0),color=new THREE.Color()
  const colors=new Float32Array(geometry.attributes.position!.count*3)
  // Vertex colors preserve one draw call; each angular strip still uses the real carved meridian.
  for(let angle=0;angle<=64;angle++)for(let j=0;j<profile.length;j++){
    const y=profile[j]!.y
    if(j>=600&&j<=601)color.copy(rimColor)
    else if(j>601)color.copy(innerColor)
    else color.copy(shellColor).lerp(grooveColor,(baseRadiusAt(y)-carvedRadius(y))/.034)
    color.toArray(colors,(angle*profile.length+j)*3)
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3))
  const body=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9}));body.name='guiro-hollow-shell';body.castShadow=body.receiveShadow=true;holder.add(body)
  const radiusAt=(y:number)=>{const i=THREE.MathUtils.clamp(y/3.2*600,0,600),a=Math.floor(i),b=Math.min(600,a+1);return THREE.MathUtils.lerp(outerPoints[a]!.x,outerPoints[b]!.x,i-a)}
  const tipRadius=.045,clearance=.001
  const contactAt=(y:number)=>{
    let z=-Infinity,contactY=y
    for(let i=0;i<outerPoints.length-1;i++){
      const a=outerPoints[i]!,b=outerPoints[i+1]!,lo=Math.max(a.y,y-tipRadius),hi=Math.min(b.y,y+tipRadius)
      if(lo>hi)continue
      const slope=(b.x-a.x)/(b.y-a.y),s=THREE.MathUtils.clamp(y+slope*tipRadius/Math.sqrt(1+slope*slope),lo,hi)
      const value=a.x+slope*(s-a.y)+Math.sqrt(Math.max(0,tipRadius*tipRadius-(s-y)*(s-y)))
      if(value>z){z=value;contactY=s}
    }
    return {z:z+clearance,contactY}
  }
  const scraper=new THREE.Group();scraper.name='guiro-scraper';holder.add(scraper)
  const wood=new THREE.MeshStandardMaterial({color:0xb98b57,roughness:.75}),tipMat=new THREE.MeshStandardMaterial({color:0xe8cd96,roughness:.9})
  const direction=new THREE.Vector3(.85,.12,.51).normalize(),quaternion=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction)
  const add=(name:string,g:THREE.BufferGeometry,mat:THREE.Material)=>{const m=new THREE.Mesh(g,mat);m.name=name;m.castShadow=m.receiveShadow=true;scraper.add(m);return m}
  const tip=add('guiro-scraper-tip',new THREE.SphereGeometry(tipRadius,24,16),tipMat)
  const shaft=add('guiro-scraper-shaft',new THREE.CylinderGeometry(.035,.035,1.35,20),wood);shaft.position.copy(direction).multiplyScalar(.675);shaft.quaternion.copy(quaternion)
  const grip=add('guiro-scraper-grip',new THREE.CapsuleGeometry(.08,.38,6,24),wood);grip.position.copy(direction).multiplyScalar(1.40);grip.quaternion.copy(quaternion)
  const state={y:2.4,contactY:2.4,lift:0}
  const pose=(at:number,n:number)=>{
    n=THREE.MathUtils.clamp(n,0,1)
    const mix=(a:number,b:number)=>n===0?a:n===1?b:THREE.MathUtils.lerp(a,b,n)
    const y=at===0?mix(2.4,.9):at===1?mix(.9,2.4):at===2?mix(2.4,2.05):2.05,lift=at===2?n:at>=3?1:0,c=contactAt(y)
    scraper.position.set(.45*lift,y,c.z+.5*lift);state.y=y;state.contactY=c.contactY;state.lift=lift
    subject.updateMatrixWorld(true)
  }
  pose(0,0)
  return {subject,holder,body,profile,outerPoints,baseRadiusAt,innerRadiusAt,radiusAt,contactAt,tipRadius,clearance,scraper,tip,shaft,grip,direction,state,pose,
    targets:[grip,grip,grip],roots:[scraper,scraper,scraper],anchors:[[0,.12,.065],[0,.12,.065],[0,.12,.065]] as [number,number,number][]}
}
