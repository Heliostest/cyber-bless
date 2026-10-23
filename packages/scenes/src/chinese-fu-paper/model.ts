import * as THREE from 'three'

/** Prepared red Fu paper, original block glyph and a product-designed household doorway. */
export function createChineseFuPaperModel() {
 const root=new THREE.Group();root.name='chinese-fu-paper-root'
 const subject=new THREE.Group();subject.name='chinese-fu-paper-subject';root.add(subject)
 const paper=new THREE.Group();paper.name='fu-paper';subject.add(paper)
 const mat=(color:number)=>new THREE.MeshStandardMaterial({color,roughness:.94})
 const red=mat(0xc83329),ink=mat(0x24201b),wood=mat(0x99734e),frame=mat(0x78563c),brass=mat(0xb19965)
 let serial=0
 const mesh=(g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D,name?:string)=>{const o=new THREE.Mesh(g,m);o.name=name??`fu-detail-${serial++}`;o.castShadow=o.receiveShadow=true;parent.add(o);return o}
 const box=(name:string,size:[number,number,number],pos:[number,number,number],m:THREE.Material,parent:THREE.Object3D=subject)=>{const o=mesh(new THREE.BoxGeometry(...size),m,parent,name);o.position.set(...pos);return o}
 const door=new THREE.Group();door.name='fu-door-leaf';subject.add(door)
 // Adjacent planks have the same front plane: the completed paper is flush across them.
 for(let i=0;i<5;i++)box(`fu-door-plank-${i}`,[1.28/5-.003,2.10,.16],[-.22+(i+.5)*1.28/5,1.05,-.11],mat([0xa48057,0x9f7951,0xa88259,0x9c764f,0xa27d55][i]!),door)
 box('fu-frame-left',[.10,2.16,.24],[-.28,1.08,-.05],frame)
 box('fu-frame-right',[.10,2.16,.24],[1.12,1.08,-.05],frame)
 box('fu-frame-top',[1.60,.13,.24],[.42,2.15,-.04],frame)
 box('fu-threshold',[1.60,.08,.30],[.42,-.04,-.03],wood)
 const handle=mesh(new THREE.TorusGeometry(.06,.012,8,32),brass,subject,'fu-door-handle');handle.position.set(.87,.45,.018)
 box('fu-handle-mount',[.035,.055,.033],[.87,.51,-.012],brass)
 // A low display holder supports the diamond tip. Front/back rails leave a real slot.
 box('fu-holder-base',[.38,.115,.29],[-.88,-.0225,.55],wood)
 box('fu-holder-back',[.26,.15,.015],[-.88,.11,.535],wood)
 box('fu-holder-shelf',[.29,.02,.085],[-.88,.15,.565],frame)
 box('fu-holder-front',[.26,.11,.015],[-.88,.215,.58],wood)
 const shape=new THREE.Shape();shape.moveTo(0,.48);shape.lineTo(-.48,0);shape.lineTo(0,-.48);shape.lineTo(.48,0);shape.closePath()
 mesh(new THREE.ExtrudeGeometry(shape,{depth:.008,bevelEnabled:false,steps:1}),red,paper,'fu-red-sheet')
 const glyph=new THREE.Group();glyph.name='fu-glyph';paper.add(glyph)
 // Original solid-stroke 福: 礻 on the left, 一 / 口 / 田 on the right.
 const stroke=(name:string,points:[number,number][])=>{const s=new THREE.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();const o=mesh(new THREE.ExtrudeGeometry(s,{depth:.0015,bevelEnabled:false,steps:1}),ink,glyph,name);o.position.z=.008;return o}
 const rect=(name:string,x:number,y:number,w:number,h:number)=>stroke(name,[[x,y],[x+w,y],[x+w,y+h],[x,y+h]])
 stroke('fu-left-dot',[[-.205,.25],[-.15,.225],[-.166,.186],[-.222,.211]])
 stroke('fu-left-turn',[[-.27,.157],[-.075,.157],[-.075,.118],[-.157,.029],[-.198,.029],[-.131,.116],[-.27,.116]])
 rect('fu-left-stem',-.199,-.24,.043,.32)
 stroke('fu-left-little-dot',[[-.13,.015],[-.073,-.045],[-.101,-.077],[-.154,-.016]])
 rect('fu-right-one',-.013,.234,.211,.034)
 rect('fu-mouth-top',-.013,.15,.22,.034)
 rect('fu-mouth-left',-.013,.06,.034,.09)
 rect('fu-mouth-right',.173,.06,.034,.09)
 rect('fu-mouth-bottom',-.013,.026,.22,.034)
 rect('fu-field-top',-.025,-.052,.245,.034)
 rect('fu-field-left',-.025,-.238,.034,.186)
 rect('fu-field-right',.186,-.238,.034,.186)
 rect('fu-field-bottom',-.025,-.25,.245,.034)
 rect('fu-field-middle-horizontal',.009,-.16,.177,.029)
 rect('fu-field-middle-vertical',.083,-.238,.03,.186)
 // Two restrained stone edges ground this small entry vignette, without a temple reconstruction.
 box('fu-entry-slab',[2.75,.06,1.35],[-.1,-.11,.19],mat(0xc8bba3),root)
 const positions:[number,number,number][]=[[-.88,.64,.55],[-.88,1.06,.55],[.42,1.26,.55],[.42,1.38,-.029]]
 const pose=(step:number,n:number)=>{
  const t=Number.isFinite(n)?THREE.MathUtils.clamp(n,0,1):0,index=THREE.MathUtils.clamp(Math.floor(step),0,3)
  const a=positions[index]!,b=positions[Math.min(index+1,3)]!
  paper.rotation.set(0,0,0)
  if(t===0||index===3)paper.position.set(...a)
  else if(t===1)paper.position.set(...b)
  else paper.position.set(THREE.MathUtils.lerp(a[0],b[0],t),THREE.MathUtils.lerp(a[1],b[1],t),THREE.MathUtils.lerp(a[2],b[2],t))
  root.updateMatrixWorld(true)
 }
 pose(0,0)
 return{root,subject,paper,targets:[paper,paper,paper],roots:[paper,paper,paper],anchors:[[0,0,.012],[0,0,.012],[0,0,.012]] as [number,number,number][],pose}
}
