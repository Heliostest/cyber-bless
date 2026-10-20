import * as THREE from 'three'

// An original wafer and one complementary corner. The relief and fracture are
// product geometry, not a reproduction of a particular family or sacred image.
export const fracture: [number, number][] = [[.12,-.7],[.2,-.66],[.23,-.59],[.31,-.55],[.35,-.47],[.43,-.43],[.47,-.35],[.55,-.3]]
export const mainOutline: [number, number][] = [[-.55,-.7],...fracture,[.55,.7],[-.55,.7]]
export const pieceOutline: [number, number][] = [...fracture.slice().reverse(),[.55,-.7]]
const clamp = THREE.MathUtils.clamp
const smooth = (n: number) => { const t=clamp(n,0,1); return t*t*(3-2*t) }

export function createOplatekModel() {
  const root=new THREE.Group();root.name='oplatek-subject'
  const holder=new THREE.Group();holder.name='oplatek-holder';root.add(holder)
  const waferBody=new THREE.Group();waferBody.name='oplatek-wafer-body';holder.add(waferBody)
  const recipient=new THREE.Group();recipient.name='oplatek-recipient';root.add(recipient)
  const pieceCarrier=new THREE.Group();pieceCarrier.name='oplatek-piece-carrier';root.add(pieceCarrier)
  const wafer=new THREE.MeshStandardMaterial({color:0xfff2d5,roughness:.91})
  const relief=new THREE.MeshStandardMaterial({color:0xf4e2bd,roughness:.92})
  const skinA=new THREE.MeshStandardMaterial({color:0xe7ac7c,roughness:.86})
  const skinB=new THREE.MeshStandardMaterial({color:0xbb7956,roughness:.86})
  const clothA=new THREE.MeshStandardMaterial({color:0x6b9496,roughness:.98})
  const clothB=new THREE.MeshStandardMaterial({color:0xb25e59,roughness:.98})
  function solid(points: [number,number][],depth:number,material:THREE.Material,name:string) {
    const shape=new THREE.Shape();points.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath()
    const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1});geometry.rotateX(-Math.PI/2);geometry.translate(0,-depth/2,0)
    const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;return mesh
  }
  const main=solid(mainOutline,.03,wafer,'oplatek-main');waferBody.add(main)
  const piece=solid(pieceOutline,.03,wafer,'oplatek-piece');pieceCarrier.add(piece)
  // Small closed embossed ribs and a star, on the unbroken central part.
  const star: [number,number][] = Array.from({length:16},(_,i)=>{const a=i*Math.PI/8, r=i%2?.045:i%4===0?.18:.10;return [Math.cos(a)*r,Math.sin(a)*r-.25]})
  const emblem=solid(star,.008,relief,'oplatek-star');emblem.position.y=.019;waferBody.add(emblem)
  function box(parent:THREE.Object3D,name:string,size:[number,number,number],position:[number,number,number],material:THREE.Material,crop=false) {
    const m=new THREE.Mesh(new THREE.BoxGeometry(...size),material);m.name=name;m.position.set(...position);m.castShadow=m.receiveShadow=true;m.userData.intentionalCrop=crop;parent.add(m);return m
  }
  for(const x of [-.49,.49])box(waferBody,'oplatek-rim-x-'+x,[.012,.006,x<0?1.14:.78],[x,.018,x<0?.06:.24],relief)
  for(const z of [-.64,.64])box(waferBody,'oplatek-rim-z-'+z,[z<0?.56:.98,.006,.012],[z<0?-.21:0,.018,z],relief)
  for(let i=0;i<3;i++)box(waferBody,'oplatek-line-'+i,[.38,.003,.006],[-.08,.0165,.19+i*.055],relief)
  function hand(parent:THREE.Group,label:string,skin:THREE.Material,cloth:THREE.Material,scale:number,yaw:number,center:[number,number,number]) {
    const g=new THREE.Group();g.name='oplatek-'+label+'-hand';g.position.set(...center);g.rotation.y=yaw;parent.add(g)
    // Flat palm tops meet the wafer underside. Fingers stay below that plane.
    box(g,'oplatek-'+label+'-palm',[.34*scale,.09,.32*scale],[0,-.06,0],skin)
    for(let i=0;i<4;i++){
      const length=(i===0?.19:i===3?.21:.25)*scale
      const finger=box(g,'oplatek-'+label+'-finger-'+i,[.069*scale,.078,length],[(i-1.5)*.081*scale,-.054,-.16*scale-length/2],skin)
      finger.rotation.y=(i-1.5)*.035
    }
    const thumb=box(g,'oplatek-'+label+'-thumb',[.09*scale,.08,.22*scale],[-.20*scale,-.055,.02*scale],skin);thumb.rotation.y=-.48
    box(g,'oplatek-'+label+'-wrist',[.23*scale,.10,.23*scale],[0,-.065,.23*scale],skin)
    box(g,'oplatek-'+label+'-forearm',[.25*scale,.12,.55*scale],[0,-.075,.60*scale],skin,true)
    box(g,'oplatek-'+label+'-sleeve',[.31*scale,.17,.85*scale],[0,-.09,1.22*scale],cloth,true)
    return g
  }
  const holderHand=hand(holder,'giver',skinA,clothA,1.5,0,[-.18,0,.25])
  const recipientHand=hand(recipient,'receiver',skinB,clothB,.64,Math.PI*.75,[.47,0,-.56])
  function pose(step:number,n:number,_update=true) {
    if(n>=1&&step<3){pose(step+1,0,_update);return}
    const t=clamp(n,0,1),offer=step>0?1:smooth(t),reach=step>1?1:step===1?smooth(t/.38):0
    const breakOff=step>1?1:step===1?smooth((t-.42)/.58):0,away=step>2?1:step===2?smooth(t):0
    holder.position.set(-.12,1.35+.18*offer,.18-.28*offer)
    // Clear the main wafer horizontally before lifting the receiving fingers.
    const lift=.08*smooth((breakOff-.92)/.08)+.06*away
    pieceCarrier.position.copy(holder.position).add(new THREE.Vector3(.18*breakOff+.22*away,lift,-.13*breakOff-.30*away))
    recipient.position.copy(holder.position).add(new THREE.Vector3(.80*(1-reach)+.18*breakOff+.22*away,-.16*(1-reach)+lift,-.70*(1-reach)-.13*breakOff-.30*away))
    if(_update)root.updateMatrixWorld(true)
  }
  pose(0,0)
  return {root,holder,recipient,main,piece,pieceCarrier,holderHand,recipientHand,pose,tick(_dt:number){},targets:[main,main,piece],roots:[waferBody,waferBody,piece],anchors:[new THREE.Vector3(-.25,.015,0),new THREE.Vector3(-.25,.015,0),new THREE.Vector3(.44,.015,-.59)]}
}
