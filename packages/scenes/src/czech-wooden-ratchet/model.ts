import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import {
  createEndGrainTextures,
  createWoodTextures,
  projectEndGrainUVs,
  projectWoodBlockUVs,
  type EndGrainSpec,
  type WoodTextureSpec,
} from './wood-grain'

/** Original held cog rattle. Kinematic elastic tongue, not an impact/stress simulation. */
export function createRatchetModel() {
  const subject=new THREE.Group();subject.name='ratchet-subject'
  const stator=new THREE.Group();stator.name='ratchet-fixed-axis';stator.position.y=2.45;subject.add(stator)
  const ownedTextures:THREE.DataTexture[]=[]
  const attachWoodMap=(material:THREE.MeshStandardMaterial,spec:WoodTextureSpec,bumpScale:number)=>{
    const {map,bumpMap}=createWoodTextures(spec)
    ownedTextures.push(map,bumpMap)
    material.map=map;material.bumpMap=bumpMap;material.bumpScale=bumpScale;material.needsUpdate=true
  }
  const attachEndGrain=(material:THREE.MeshStandardMaterial,spec:EndGrainSpec,bumpScale:number)=>{
    const {map,bumpMap}=createEndGrainTextures(spec)
    ownedTextures.push(map,bumpMap)
    material.map=map;material.bumpMap=bumpMap;material.bumpScale=bumpScale;material.needsUpdate=true
  }
  const softWood=(color:number,axis:'x'|'y'|'z',scale:number,strength:number,roughness:number,spec:WoodTextureSpec,bumpScale=.0056)=>{
    const material=new THREE.MeshStandardMaterial({color,roughness})
    attachWoodMap(material,spec,bumpScale)
    return applyCraftSurface(material,{kind:'wood',axis,scale,strength})
  }
  const hardWood=(color:number,axis:'x'|'y'|'z',scale:number,strength:number,options:{roughness?:number;clearcoat?:number;clearcoatRoughness?:number;bumpScale?:number;endGrain?:EndGrainSpec;wood?:WoodTextureSpec}={})=>{
    const material=new THREE.MeshPhysicalMaterial({color,roughness:options.roughness??.64,clearcoat:options.clearcoat??.16,clearcoatRoughness:options.clearcoatRoughness??.42})
    if(options.endGrain)attachEndGrain(material,options.endGrain,options.bumpScale??.0046)
    else if(options.wood)attachWoodMap(material,options.wood,options.bumpScale??.0054)
    return applyCraftSurface(material,{kind:'wood',axis,scale,strength})
  }
  // Distinct hand-cut wood parts with organic flowing grain, sparse knots, and warm tonal contrast:
  // pale clear-grained ash tongue, two distinct honey-spruce frame cheeks, golden-beech top bar,
  // oiled cherry/beech turned handle, warm walnut cogwheel & hub, and dark end-grain hardwood axle/retainers.
  const frontCheekWood=softWood(0xdbb274,'y',.58,.12,.77,{
    id:'ratchet-front-cheek-v2',width:512,height:256,aspect:4.5,ringFreq:6.8,archSlope:0.58,pithV:0.58,pithU:0.34,
    pithDepth:0.25,flowAmp:0.22,contrast:0.225,warmth:0.88,toneVariation:0.055,fiberStrength:0.024,seed:14.7,
    knots:[
      {u:0.66,v:0.38,radius:0.050,elongation:2.15,deflect:0.86,depth:0.86,rings:3.0},
      {u:0.27,v:0.78,radius:0.028,elongation:2.3,deflect:0.74,depth:0.70,rings:2.4},
    ],
  },.0058)
  const backCheekWood=softWood(0xd2a768,'y',.74,.12,.78,{
    id:'ratchet-back-cheek-v2',width:512,height:256,aspect:4.5,ringFreq:5.2,archSlope:0.46,pithV:0.30,pithU:0.62,
    pithDepth:0.28,flowAmp:0.21,contrast:0.215,warmth:0.86,toneVariation:0.055,fiberStrength:0.024,seed:29.3,
    knots:[{u:0.48,v:0.60,radius:0.044,elongation:2.2,deflect:0.82,depth:0.82,rings:2.9}],
  },.0054)
  const gripWood=softWood(0xd5a765,'x',.66,.12,.75,{
    id:'ratchet-top-bar-v2',width:512,height:256,aspect:2.3,ringFreq:7.2,archSlope:0.50,pithV:0.36,pithU:0.56,
    pithDepth:0.27,flowAmp:0.20,contrast:0.22,warmth:0.88,toneVariation:0.055,fiberStrength:0.024,seed:43.1,
    knots:[{u:0.25,v:0.68,radius:0.048,elongation:2.2,deflect:0.84,depth:0.84,rings:2.9}],
  },.0056)
  const handleWood=hardWood(0xca9255,'z',.88,.13,{
    roughness:.58,clearcoat:.19,clearcoatRoughness:.38,bumpScale:.0048,
    wood:{
      id:'ratchet-handle-v2',width:512,height:256,aspect:3.4,ringFreq:7.6,archSlope:0.54,pithV:0.44,pithU:0.42,
      pithDepth:0.26,flowAmp:0.18,contrast:0.23,warmth:0.88,toneVariation:0.055,fiberStrength:0.026,seed:61.8,
      knots:[{u:0.56,v:0.34,radius:0.036,elongation:2.3,deflect:0.78,depth:0.72,rings:2.6}],
    },
  })
  const cogWood=hardWood(0xad713d,'x',.94,.13,{
    roughness:.65,clearcoat:.14,clearcoatRoughness:.44,bumpScale:.0058,
    wood:{
      id:'ratchet-cog-wheel-v2',aspect:1.15,ringFreq:8.6,archSlope:0.40,pithV:0.62,pithU:0.46,
      pithDepth:0.30,flowAmp:0.19,contrast:0.25,warmth:0.90,toneVariation:0.055,fiberStrength:0.028,seed:79.4,
      knots:[{u:0.32,v:0.26,radius:0.042,elongation:2.1,deflect:0.78,depth:0.80,rings:2.8}],
    },
  })
  const hubWood=hardWood(0xa46a3a,'z',.98,.13,{
    roughness:.65,clearcoat:.14,clearcoatRoughness:.44,bumpScale:.0046,
    wood:{
      id:'ratchet-hub-v1',aspect:1.1,ringFreq:7.2,archSlope:0.32,pithV:0.48,pithU:0.52,
      pithDepth:0.36,flowAmp:0.16,contrast:0.19,warmth:0.88,toneVariation:0.05,fiberStrength:0.026,seed:93.2,
    },
  })
  const axleWood=hardWood(0x755231,'z',1.12,.12,{
    roughness:.63,clearcoat:.13,clearcoatRoughness:.45,bumpScale:.0048,
    endGrain:{id:'ratchet-axle-endgrain-v1',ringFreq:10.5,contrast:0.26,warmth:0.86,pithX:0.45,pithY:0.54,seed:107.6},
  })
  const frontRetainerWood=hardWood(0x825d3b,'z',.96,.12,{
    roughness:.65,clearcoat:.12,clearcoatRoughness:.46,bumpScale:.0044,
    endGrain:{id:'ratchet-front-retainer-v1',ringFreq:8.6,contrast:0.22,warmth:0.84,pithX:0.56,pithY:0.44,seed:121.3},
  })
  const backRetainerWood=hardWood(0x7c5837,'z',1.04,.12,{
    roughness:.65,clearcoat:.12,clearcoatRoughness:.46,bumpScale:.0044,
    endGrain:{id:'ratchet-back-retainer-v1',ringFreq:9.2,contrast:0.22,warmth:0.84,pithX:0.42,pithY:0.58,seed:137.9},
  })
  // Flexible clapper tongue uses clear straight-ish pale ash grain with gentle wave and no knots.
  const tongueWood=softWood(0xf4da9d,'y',1.05,.11,.76,{
    id:'ratchet-tongue-ash-v2',aspect:6.8,ringFreq:9.4,archSlope:0.16,pithV:0.78,pithU:0.44,
    pithDepth:0.46,flowAmp:0.14,contrast:0.17,warmth:0.76,toneVariation:0.04,fiberStrength:0.024,seed:151.5,
  },.0038)
  const sage=new THREE.MeshPhysicalMaterial({color:0x93be9f,roughness:.66,clearcoat:.16,clearcoatRoughness:.42})
  attachWoodMap(sage,{
    id:'ratchet-sage-accent-v1',aspect:1.6,ringFreq:6.4,archSlope:0.28,pithV:0.42,pithU:0.5,
    pithDepth:0.38,flowAmp:0.16,contrast:0.085,warmth:0.45,toneVariation:0.03,fiberStrength:0.018,seed:167.2,
  },.0026)
  applyCraftSurface(sage,{kind:'wood',axis:'x',scale:.70,strength:.11})
  const add=(name:string,g:THREE.BufferGeometry,material:THREE.Material,parent:THREE.Object3D=stator)=>{const mesh=new THREE.Mesh(g,material);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh}
  const polygon:THREE.Vector2[]=[]
  for(let tooth=0;tooth<11;tooth++)for(const [phase,r]of[[0,.43],[.72,.57],[.85,.57]]){const a=(tooth+phase!)*Math.PI*2/11;polygon.push(new THREE.Vector2(r!*Math.cos(a),r!*Math.sin(a)))}
  const wheelShape=new THREE.Shape(polygon),hole=new THREE.Path();hole.absarc(0,0,.12,0,Math.PI*2,true);wheelShape.holes.push(hole)
  const halfGearDepth=.11,cheekDepth=.09,wheelGeometry=new THREE.ExtrudeGeometry(wheelShape,{depth:halfGearDepth*2,bevelEnabled:false,curveSegments:32});wheelGeometry.translate(0,0,-halfGearDepth)
  projectWoodBlockUVs(wheelGeometry,'x',{tilt:1.28})
  const gear=add('ratchet-cog-wheel',wheelGeometry,cogWood)
  const cylinder=(name:string,r:number,length:number,z:number,material:THREE.Material=axleWood,endGrain=false)=>{const g=new THREE.CylinderGeometry(r,r,length,32);g.rotateX(Math.PI/2);if(endGrain)projectEndGrainUVs(g);else projectWoodBlockUVs(g,'z',{tilt:.48});const mesh=add(name,g,material);mesh.position.z=z;return mesh}
  const turnedHandle=(name:string,r:number,length:number,z:number,material:THREE.Material)=>{
    const half=length/2,bevel=.014
    const pts=[
      new THREE.Vector2(0,-half),new THREE.Vector2(r*.5,-half),new THREE.Vector2(r-bevel,-half),
      new THREE.Vector2(r-bevel*.3,-half+bevel*.3),new THREE.Vector2(r,-half+bevel),
      new THREE.Vector2(r,half-bevel),new THREE.Vector2(r-bevel*.3,half-bevel*.3),
      new THREE.Vector2(r-bevel,half),new THREE.Vector2(r*.5,half),new THREE.Vector2(0,half),
    ]
    const g=new THREE.LatheGeometry(pts,32);g.rotateX(Math.PI/2)
    projectWoodBlockUVs(g,'z',{tilt:.56})
    const mesh=add(name,g,material);mesh.position.z=z;return mesh
  }
  const axle=cylinder('ratchet-axle',.10,1.96,.50,axleWood,true),handle=turnedHandle('ratchet-handle',.16,1.10,.88,handleWood)
  cylinder('ratchet-wheel-hub',.18,.27,0,hubWood,false)
  const frame=new THREE.Group();frame.name='ratchet-frame';stator.add(frame)
  const cheeks:THREE.Mesh<THREE.ExtrudeGeometry>[]=[]
  for(const z of[-.20,.20]){
    const shape=new THREE.Shape();shape.moveTo(-.22,0);shape.absarc(0,0,.22,Math.PI,Math.PI*2,false);shape.lineTo(.22,1.88);shape.lineTo(-.22,1.88);shape.closePath()
    const aperture=new THREE.Path();aperture.absarc(0,0,.12,0,Math.PI*2,true);shape.holes.push(aperture)
    const g=new THREE.ExtrudeGeometry(shape,{depth:cheekDepth,bevelEnabled:false,curveSegments:24});g.translate(0,0,-cheekDepth/2)
    projectWoodBlockUVs(g,'y',{tilt:z<0?.34:.30,flipV:z<0})
    const cheek=add(z<0?'ratchet-back-cheek':'ratchet-front-cheek',g,z<0?backCheekWood:frontCheekWood,frame) as THREE.Mesh<THREE.ExtrudeGeometry>;cheek.position.z=z;cheeks.push(cheek)
  }
  const washers:THREE.Mesh<THREE.ExtrudeGeometry>[]=[]
  for(const z of[-.31,.31]){const shape=new THREE.Shape();shape.absarc(0,0,.22,0,Math.PI*2,false);const hole=new THREE.Path();hole.absarc(0,0,.105,0,Math.PI*2,true);shape.holes.push(hole);const g=new THREE.ExtrudeGeometry(shape,{depth:.06,bevelEnabled:false,curveSegments:28});g.translate(0,0,-.03);projectEndGrainUVs(g);const mesh=add(z<0?'ratchet-back-retainer':'ratchet-front-retainer',g,z<0?backRetainerWood:frontRetainerWood) as THREE.Mesh<THREE.ExtrudeGeometry>;mesh.position.z=z;washers.push(mesh)}
  const gripGeo=new RoundedBoxGeometry(1.18,.24,.56,3,.016);projectWoodBlockUVs(gripGeo,'x',{tilt:.82})
  const grip=add('ratchet-frame-grip',gripGeo,gripWood,frame);grip.position.set(.30,1.80,0)
  const accentGeo=new RoundedBoxGeometry(.12,.245,.565,3,.016);projectWoodBlockUVs(accentGeo,'x',{tilt:.82})
  const accent=add('ratchet-grip-accent',accentGeo,sage,grip);accent.position.x=.42
  const anchorX=.72,length=1.72,halfWidth=.0175,halfDepth=.065,capRadius=.03,clearance=.001,rowCount=33
  const weights=Array.from({length:rowCount},(_,i)=>{const t=1-i/(rowCount-1);return t*t*(3-t)/2})
  const weightAt=(y:number)=>{const q=THREE.MathUtils.clamp(y/length*(rowCount-1),0,rowCount-1),i=Math.min(rowCount-2,Math.floor(q));return THREE.MathUtils.lerp(weights[i]!,weights[i+1]!,q-i)}
  const tongueGeometry=new THREE.BufferGeometry(),indices:number[]=[]
  tongueGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(rowCount*4*3),3))
  const tongueUVs=new Float32Array(rowCount*4*2)
  const edgeV=[.12,.38,.66,.90]
  for(let row=0;row<rowCount;row++){
    const u=.03+.94*(row/(rowCount-1))
    for(let edge=0;edge<4;edge++){const k=(row*4+edge)*2;tongueUVs[k]=u;tongueUVs[k+1]=edgeV[edge]!}
  }
  tongueGeometry.setAttribute('uv',new THREE.BufferAttribute(tongueUVs,2))
  for(let row=0;row<rowCount-1;row++)for(let edge=0;edge<4;edge++){const a=row*4+edge,b=(row+1)*4+edge,c=row*4+(edge+1)%4,d=(row+1)*4+(edge+1)%4;indices.push(a,b,c,b,d,c)}
  indices.push(0,1,2,0,2,3);const top=(rowCount-1)*4;indices.push(top,top+2,top+1,top,top+3,top+2);tongueGeometry.setIndex(indices)
  const spring=add('ratchet-wood-tongue',tongueGeometry,tongueWood,frame)
  const capGeometry=new THREE.CylinderGeometry(capRadius,capRadius,halfDepth*2,32);capGeometry.rotateX(Math.PI/2);projectWoodBlockUVs(capGeometry,'y',{tilt:.45})
  const cap=add('ratchet-tongue-rounded-end',capGeometry,tongueWood,frame)
  const state={d:0,contactGap:clearance,contactY:0,contactKind:'cap'}
  const pose=(at:number,n:number)=>{
    n=THREE.MathUtils.clamp(n,0,1)
    const angle=at+n===0||at>=3||at===2&&n===1?0:-(at+n)*(Math.PI*2/3)
    frame.rotation.z=angle
    const rotated=polygon.map(p=>p.clone().rotateAround(new THREE.Vector2(),-angle))
    let d=-Infinity,witnessY=0,kind='face',capEnvelope=-Infinity
    const constrain=(x:number,y:number)=>{if(y<0||y>=length)return;const f=weightAt(y);if(f<1e-12)return;const needed=(x+halfWidth+clearance-anchorX)/f;if(needed>d){d=needed;witnessY=y;kind='face'}}
    for(let i=0;i<rotated.length;i++){
      const a=rotated[i]!,b=rotated[(i+1)%rotated.length]!,dy=b.y-a.y
      constrain(a.x,a.y)
      for(let row=0;row<rowCount;row++){const y=length*row/(rowCount-1);if(Math.abs(dy)>1e-12&&y>=Math.min(a.y,b.y)&&y<=Math.max(a.y,b.y))constrain(THREE.MathUtils.lerp(a.x,b.x,(y-a.y)/dy),y)}
      // The expanded circle gives a true Euclidean clearance around the rounded end.
      const r=capRadius+clearance,lo=Math.max(Math.min(a.y,b.y),-r),hi=Math.min(Math.max(a.y,b.y),r)
      if(lo<=hi){
        if(Math.abs(dy)<1e-12)capEnvelope=Math.max(capEnvelope,Math.max(a.x,b.x)+Math.sqrt(Math.max(0,r*r-a.y*a.y)))
        else {const slope=(b.x-a.x)/dy,y=THREE.MathUtils.clamp(slope*r/Math.sqrt(1+slope*slope),lo,hi);capEnvelope=Math.max(capEnvelope,a.x+slope*(y-a.y)+Math.sqrt(Math.max(0,r*r-y*y)))}
      }
    }
    if(capEnvelope-anchorX>d){d=capEnvelope-anchorX;kind='cap';witnessY=0}
    const positions=tongueGeometry.attributes.position!
    for(let row=0;row<rowCount;row++){const x=anchorX+d*weights[row]!,y=length*row/(rowCount-1);positions.setXYZ(row*4,x-halfWidth,y,-halfDepth);positions.setXYZ(row*4+1,x+halfWidth,y,-halfDepth);positions.setXYZ(row*4+2,x+halfWidth,y,halfDepth);positions.setXYZ(row*4+3,x-halfWidth,y,halfDepth)}
    positions.needsUpdate=true;tongueGeometry.computeVertexNormals();tongueGeometry.computeBoundingSphere();cap.position.x=anchorX+d
    state.d=d;state.contactKind=kind;state.contactY=witnessY;state.contactGap=clearance;subject.updateMatrixWorld(true)
  }
  const disposeTextures=()=>{ownedTextures.forEach(tex=>tex.dispose())}
  pose(0,0)
  return {subject,stator,gear,polygon,frame,cheeks,washers,axle,handle,grip,spring,cap,halfGearDepth,cheekDepth,anchorX,length,halfWidth,halfDepth,capRadius,clearance,rowCount,weights,state,pose,disposeTextures,
    targets:[grip,grip,grip],roots:[frame,frame,frame],anchors:[[.15,.06,.30],[.15,.06,.30],[.15,.06,.30]] as [number,number,number][]}
}
