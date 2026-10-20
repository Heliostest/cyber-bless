import * as THREE from 'three'

// Kameido's straight wooden bullfinch, not Dazaifu's curled-wing form.
export function createUsokaeModel() {
  const root=new THREE.Group();root.name='usokae-root'
  const subject=new THREE.Group();subject.name='usokae-subject';root.add(subject)
  const material=(color:string,roughness=.88)=>new THREE.MeshStandardMaterial({color,roughness,metalness:0})
  const wood=material('#d3a766'),oldWood=material('#ba9464'),grain=material('#ac814d'),ink=material('#393e3e'),red=material('#c65c50'),oldRed=material('#aa6958'),eye=material('#f6e5bd'),stone=material('#b9bba3'),support=material('#98785a')
  const mesh=(name:string,geometry:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D)=>{const o=new THREE.Mesh(geometry,m);o.name=name;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
  // Front of the actual twelve-sided column and tapered crown.
  const skin=(x:number,y:number)=>{const r=y<=.91?.23-.005*y/.91:.225-.325*(y-.91),ax=Math.abs(x);return ax<=r*.5?r-ax*Math.tan(Math.PI/12):ax<=r*Math.sqrt(3)/2?r*(1+Math.sqrt(3))/2-ax:(r-ax)/Math.tan(Math.PI/12)}
  const paint=(name:string,shape:THREE.Shape,m:THREE.Material,parent:THREE.Object3D,offset=0)=>{
    const source=new THREE.ExtrudeGeometry(shape,{depth:.004,bevelEnabled:false,curveSegments:12}),positions=source.getAttribute('position')
    // Split every face at each wood/crown facet boundary before mapping it.
    // Mapping only outline vertices would bury large triangles inside the wood.
    const planes=[(p:THREE.Vector3)=>p.y-.91,(p:THREE.Vector3)=>p.x]
    for(const factor of[.5,Math.sqrt(3)/2])for(const sign of[-1,1]){
      planes.push(p=>p.x-sign*factor*(.23-.005*p.y/.91))
      planes.push(p=>p.x-sign*factor*(.225-.325*(p.y-.91)))
    }
    const result:number[]=[]
    for(let i=0;i<positions.count;i+=3){
      let polygons=[[0,1,2].map(n=>new THREE.Vector3().fromBufferAttribute(positions,i+n))]
      for(const distance of planes){const next:THREE.Vector3[][]=[];for(const polygon of polygons){
        const values=polygon.map(distance)
        if(!values.some(v=>v>1e-9)||!values.some(v=>v< -1e-9)){next.push(polygon);continue}
        for(const side of[-1,1]){const clipped:THREE.Vector3[]=[];for(let j=0;j<polygon.length;j++){
          const p=polygon[j]!,q=polygon[(j+1)%polygon.length]!,u=values[j]!,v=values[(j+1)%polygon.length]!
          if(side*u>=-1e-9)clipped.push(p)
          if((u>1e-9&&v< -1e-9)||(u< -1e-9&&v>1e-9))clipped.push(p.clone().lerp(q,u/(u-v)))
        }if(clipped.length>=3)next.push(clipped)}
      }polygons=next}
      for(const polygon of polygons)for(let j=1;j<polygon.length-1;j++){
        const vertices=[polygon[0]!,polygon[j]!,polygon[j+1]!].map(p=>new THREE.Vector3(p.x,p.y,skin(p.x,p.y)+p.z+offset))
        if(new THREE.Triangle(...vertices as [THREE.Vector3,THREE.Vector3,THREE.Vector3]).getArea()<1e-12)continue
        vertices.forEach(p=>result.push(p.x,p.y,p.z))
      }
    }
    // Weld after Float32 conversion: facet intersections can otherwise collapse
    // into zero-area slivers when uploaded to the GPU.
    const floats=new Float32Array(result),points:THREE.Vector3[]=[],ids:number[]=[],weld=new Map<string,number>()
    for(let i=0;i<floats.length;i+=3){const p=new THREE.Vector3(floats[i]!,floats[i+1]!,floats[i+2]!),key=p.toArray().map(v=>Math.round(v*1e6)).join(',');let id=weld.get(key);if(id===undefined){id=points.length;points.push(p);weld.set(key,id)}ids.push(id)}
    const faces:number[]=[],seen=new Set<string>()
    for(let i=0;i<ids.length;i+=3){const a=ids[i]!,b=ids[i+1]!,c=ids[i+2]!,key=[a,b,c].sort((x,y)=>x-y).join(',');if(a===b||b===c||a===c||seen.has(key)||new THREE.Triangle(points[a]!,points[b]!,points[c]!).getArea()<1e-12)continue;seen.add(key);faces.push(a,b,c)}
    source.dispose();const indexed=new THREE.BufferGeometry();indexed.setAttribute('position',new THREE.Float32BufferAttribute(points.flatMap(p=>p.toArray()),3));indexed.setIndex(faces);const geometry=indexed.toNonIndexed();indexed.dispose();geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return mesh(name,geometry,m,parent)
  }
  const paintedStroke=(name:string,x1:number,y1:number,x2:number,y2:number,width:number,m:THREE.Material,parent:THREE.Object3D)=>{const length=Math.hypot(x2-x1,y2-y1),dx=-(y2-y1)/length*width,dy=(x2-x1)/length*width,s=new THREE.Shape();s.moveTo(x1+dx,y1+dy);s.lineTo(x2+dx,y2+dy);s.lineTo(x2-dx,y2-dy);s.lineTo(x1-dx,y1-dy);s.closePath();return paint(name,s,m,parent)}
  const bird=(name:string,w:THREE.Material,r:THREE.Material)=>{
    const g=new THREE.Group();g.name=name;subject.add(g)
    const body=mesh(name+'-wood-body',new THREE.CylinderGeometry(.225,.23,.91,12),w,g);body.position.y=.455
    const crown=mesh(name+'-black-crown',new THREE.CylinderGeometry(.16,.225,.20,12),ink,g);crown.position.y=1.01
    // Solid low relief painted areas follow the front facet; no flat display cards.
    const shape=new THREE.Shape();shape.moveTo(-.16,.91);shape.lineTo(-.15,.78);shape.quadraticCurveTo(0,.65,.15,.78);shape.lineTo(.16,.91);shape.lineTo(.04,.97);shape.lineTo(-.04,.97);shape.closePath()
    paint(name+'-red-cheeks',shape,r,g)
    for(const side of[-1,1]){
      const e=new THREE.Shape();e.absarc(side*.123,.994,.020,0,Math.PI*2,false);paint(name+'-eye-'+side,e,eye,g)
      const pupil=new THREE.Shape();pupil.absarc(side*.123,.994,.009,0,Math.PI*2,false);paint(name+'-pupil-'+side,pupil,ink,g,.004)
      for(let n=0;n<3;n++)paintedStroke(name+'-foot-'+side+'-'+n,side*.075,.66,side*(.052+n*.027),.56-n*.015,.005,ink,g)
    }
    for(let n=-2;n<=2;n++){const x=n*.062;paintedStroke(name+'-grain-'+n,x,.06,x+.006,.45+(n+2)*.024,.0015,grain,g)}
    const beak=mesh(name+'-beak',new THREE.ConeGeometry(.036,.07,4),ink,g);beak.rotation.x=Math.PI/2;beak.position.set(0,.963,skin(0,.963)+.025)
    return {g,body}
  }
  const old=bird('old-wood-uso',oldWood,oldRed),fresh=bird('new-wood-uso',wood,red)
  const ledge=mesh('shrine-receiving-ledge',new THREE.BoxGeometry(2.3,.12,.58),support,root);ledge.position.set(0,.76,-.55)
  const plinth=mesh('ledge-plinth',new THREE.BoxGeometry(2.14,.712,.46),stone,root);plinth.position.set(0,.344,-.59)
  const lip=mesh('ledge-front-trim',new THREE.BoxGeometry(2.32,.055,.045),wood,root);lip.position.set(0,.77,-.25)
  const base=mesh('home-display-base',new THREE.CylinderGeometry(.46,.49,.102,48),wood,root);base.position.set(-.25,.039,.65)
  const pose=(step:number,amount:number)=>{
    const t=THREE.MathUtils.clamp(Number.isFinite(amount)?amount:0,0,1)
    old.g.position.set(-.25,.09,.65);fresh.g.position.set(.72,.82,-.55)
    if(step===0){old.g.position.set(THREE.MathUtils.lerp(-.25,-.72,t),THREE.MathUtils.lerp(.09,.82,t)+Math.sin(Math.PI*t)*.40,THREE.MathUtils.lerp(.65,-.55,t))}
    else old.g.position.set(-.72,.82,-.55)
    if(step===1)fresh.g.position.set(THREE.MathUtils.lerp(.72,-.25,t),THREE.MathUtils.lerp(.82,.85,t)+Math.sin(Math.PI*t)*.28,THREE.MathUtils.lerp(-.55,.65,t))
    else if(step===2)fresh.g.position.set(-.25,THREE.MathUtils.lerp(.85,.09,t),.65)
    else if(step>=3)fresh.g.position.set(-.25,.09,.65)
    root.updateMatrixWorld(true)
  }
  pose(0,0)
  return {root,subject,old,fresh,base,ledge,targets:[old.g,fresh.g,fresh.g],roots:[old.g,fresh.g,fresh.g],anchors:[[0,.82,.225],[0,.82,.225],[0,.82,.225]] as [number,number,number][],pose,dispose:()=>{}}
}
