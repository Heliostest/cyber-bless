import * as THREE from 'three'

export type YutPoseOptions = { mask?: number; fromMask?: number; position?: number; steps?: number; repeat?: boolean }

/** Original half-round wood, woven playing mat and29station cloth board. */
export function createYutnoriModel() {
  const subject=new THREE.Group();subject.name='yut-subject'
  const material=(color:number,roughness=.8)=>new THREE.MeshStandardMaterial({color,roughness})
  const reed=material(0xc69357),weave=material(0xd6ab6b),cloth=material(0xd6e5dc,1),ink=material(0x287680),ivory=material(0xf7e2b4),blue=material(0x379cb2,.42)
  const add=(parent:THREE.Object3D,name:string,geometry:THREE.BufferGeometry,mat:THREE.Material)=>{
    const m=new THREE.Mesh(geometry,mat);m.name=name;m.castShadow=m.receiveShadow=true;parent.add(m);return m
  }
  const box=(parent:THREE.Object3D,name:string,w:number,h:number,d:number,mat:THREE.Material,x:number,y:number,z:number)=>{
    const m=add(parent,name,new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);return m
  }
  box(subject,'yut-mat',3.15,.035,4.15,reed,0,-.0175,.32)
  // Low woven edges are the playing surface, not display furniture.
  for(let i=0;i<51;i++)for(const x of [-1.52,1.52])box(subject,`yut-weave-${i}-${x}`, .075,.004,.032,weave,x,-.001,-1.70+i*.080)
  for(let i=0;i<35;i++)box(subject,`yut-near-weave-${i}`, .028,.004,.08,weave,-1.49+i*.087,-.001,2.35)
  box(subject,'yut-board',2.83,.018,2.83,cloth,0,.009,-.2)
  const line=(name:string,a:[number,number],b:[number,number])=>{
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]),m=box(subject,name,length,.003,.018,ink,(a[0]+b[0])/2,.020,(a[1]+b[1])/2)
    m.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);m.castShadow=false
  }
  const corners:[number,number][]=[[1.2,1],[1.2,-1.4],[-1.2,-1.4],[-1.2,1]]
  const stations:[number,number][]=[]
  for(let edge=0;edge<4;edge++){
    const a=corners[edge]!,b=corners[(edge+1)%4]!;line(`yut-path-${edge}`,a,b)
    for(let n=0;n<5;n++)stations.push([THREE.MathUtils.lerp(a[0],b[0],n/5),THREE.MathUtils.lerp(a[1],b[1],n/5)])
  }
  line('yut-diagonal-0',corners[0]!,corners[2]!);line('yut-diagonal-1',corners[1]!,corners[3]!)
  for(const [a,b] of [[corners[0]!,corners[2]!],[corners[1]!,corners[3]!]])for(let n=1;n<6;n++){
    if(n===3&&stations.length>24)continue
    stations.push([THREE.MathUtils.lerp(a![0],b![0],n/6),THREE.MathUtils.lerp(a![1],b![1],n/6)])
  }
  stations.forEach(([x,z],i)=>{
    const corner=i<20&&i%5===0,r=corner?.11:.068
    const station=add(subject,`yut-station-${i}`,new THREE.CylinderGeometry(r,r,.004,24),ink);station.position.set(x,.024,z);station.castShadow=false
    const core=add(subject,`yut-station-center-${i}`,new THREE.CylinderGeometry(r*.63,r*.63,.002,24),ivory);core.position.set(x,.027,z);core.castShadow=false
  })
  const token=add(subject,'yut-token',new THREE.CylinderGeometry(.15,.165,.12,40),blue)
  const rim=add(token,'yut-token-rim',new THREE.TorusGeometry(.124,.007,6,40),ivory);rim.rotation.x=Math.PI/2;rim.position.y=.055
  const sticksGroup=new THREE.Group();sticksGroup.name='yut-sticks';subject.add(sticksGroup)
  const sticks:THREE.Group[]=[],shells:THREE.Mesh[]=[]
  const shape=new THREE.Shape();shape.moveTo(-.12,0);shape.absarc(0,0,.12,Math.PI,0,true);shape.closePath()
  const wood=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.69}),mark=material(0xa3693b)
  for(let i=0;i<4;i++){
    const stick=new THREE.Group();stick.name=`yut-stick-${i}`;sticksGroup.add(stick);sticks.push(stick)
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:.94,steps:1,curveSegments:18,bevelEnabled:true,bevelThickness:.006,bevelSize:.006,bevelSegments:2})
    geometry.translate(0,-.06,-.47)
    const normals=geometry.getAttribute('normal'),positions=geometry.getAttribute('position'),colors=[] as number[]
    const flatColor=new THREE.Color(0xf2d197),roundColor=new THREE.Color(0xd6a15d),endColor=new THREE.Color(0xbb854e)
    for(let v=0;v<positions.count;v++){
      const color=Math.abs(normals.getZ(v))>.9?endColor:normals.getY(v)<-.85?flatColor:roundColor
      colors.push(color.r,color.g,color.b)
    }
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3))
    const shell=add(stick,`yut-stick-${i}-shell`,geometry,wood);shells.push(shell)
    // Original simple end marks distinguish flat faces without copying a regional set.
    for(const z of [-.28,.28])box(stick,`yut-stick-${i}-flat-mark-${z}`,.15,.002,.018,mark,0,-.067,z)
  }
  const bounds=new THREE.Box3()
  const pose=(at:number,n:number,options:YutPoseOptions={})=>{
    n=THREE.MathUtils.clamp(n,0,1)
    const mask=options.mask??5,fromMask=options.fromMask??5,repeat=options.repeat??false
    const gather=at===0?n:1,roll=at===1?n:at>1?1:0
    // The accepted result is sampled on release; preview motion must not reveal it.
    const landing=THREE.MathUtils.smoothstep(roll,.2,1)
    sticks.forEach((stick,i)=>{
      const spread=(i-1.5)*.60,compact=(i-1.5)*.36
      const flat=(mask>>i)&1,previousFlat=(fromMask>>i)&1
      let x=THREE.MathUtils.lerp(THREE.MathUtils.lerp(spread,compact,gather),spread,roll)
      let yaw=(i-1.5)*.045*roll,angle=Math.PI*(2*roll+flat*landing)
      if(at===1&&repeat){
        x=THREE.MathUtils.lerp(spread,compact,Math.sin(Math.PI*n))
        yaw=(i-1.5)*.045
        angle=Math.PI*(2+previousFlat+2*n+(flat-previousFlat)*landing)
      }
      stick.position.set(x,0,1.80)
      stick.rotation.set(0,yaw,angle)
      stick.updateWorldMatrix(true,true);bounds.setFromObject(stick,true)
      const lift=at===0?.12*Math.sin(Math.PI*n):at===1?1.22*Math.sin(Math.PI*n):0
      stick.position.y=-bounds.min.y+Math.max(0,lift)
    })
    const position=((Math.floor(options.position??0)%20)+20)%20,steps=Math.max(0,Math.floor(options.steps??2))
    const advance=at===2?n*steps:at>2&&options.position===undefined?steps:0,segment=Math.floor(advance),part=advance-segment
    const a=stations[(position+segment)%20]!,b=stations[(position+segment+1)%20]!
    token.position.set(THREE.MathUtils.lerp(a[0],b[0],part),.088+.15*Math.sin(Math.PI*part),THREE.MathUtils.lerp(a[1],b[1],part))
    subject.updateMatrixWorld(true)
  }
  pose(0,0)
  return {subject,pose,targets:[shells[0]!,shells[0]!,token],roots:[sticksGroup,sticksGroup,token],anchors:[[0,.068,0],[0,.068,0],[.06,.061,0]] as [number,number,number][]}
}
