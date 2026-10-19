import * as THREE from 'three'

/** Original cord-linked shells. Angles are assisted display kinematics, not finger forces. */
export function createCastanetsModel() {
  const subject = new THREE.Group(); subject.name = 'cast-subject'
  const pairs: THREE.Group[] = [], pivots: THREE.Group[] = [], upper: THREE.Mesh[] = [], lower: THREE.Mesh[] = [], eyes: THREE.Mesh[] = [], cords: THREE.Mesh[] = []
  let cordPoints: THREE.Vector3[] = []
  const cordMaterial = new THREE.MeshStandardMaterial({ color: '#29665f', roughness: .95 })
  function shellGeometry(invert: boolean) {
    const vertices: number[] = [], indices: number[] = [], segments = 48
    const point = (r: number, y: number, angle: number) => { const i = vertices.length / 3; vertices.push(.7*r*Math.cos(angle), y*(invert?-1:1), .96*r*Math.sin(angle)); return i }
    const triangle = (a: number,b: number,c: number) => indices.push(a, invert?c:b, invert?b:c)
    const disk = (inside: boolean) => {
      const center = point(0, inside?-.21:-.34,0); let previous: number[] = []
      for(let j=1;j<=8;j++) {
        const r=(inside?.84:1)*j/8, y=inside?-.21*(1-(r/.84)**2):-.34*(1-r*r), ring=Array.from({length:segments},(_,k)=>point(r,y,k/segments*Math.PI*2))
        for(let k=0;k<segments;k++) { const n=(k+1)%segments, a=j===1?center:previous[k]!, b=ring[k]!, c=ring[n]!
          if(inside)triangle(a,c,b);else triangle(a,b,c)
          if(j>1) {if(inside)triangle(a,previous[n]!,c);else triangle(a,c,previous[n]!)}
        }
        previous=ring
      }
      return previous
    }
    const outside=disk(false),inside=disk(true),cutStart=indices.length
    for(let k=0;k<segments;k++){const n=(k+1)%segments;triangle(outside[k]!,inside[k]!,inside[n]!);triangle(outside[k]!,inside[n]!,outside[n]!)}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.addGroup(0,cutStart,0);g.addGroup(cutStart,indices.length-cutStart,1);g.computeVertexNormals();g.computeBoundingSphere();return g
  }
  const mesh=(name:string,g:THREE.BufferGeometry,mat:THREE.Material|THREE.Material[],parent:THREE.Object3D)=>{const o=new THREE.Mesh(g,mat);o.name=name;o.castShadow=o.receiveShadow=true;parent.add(o);return o}
  for(let k=0;k<2;k++) {
    const pair=new THREE.Group();pair.name='cast-pair-'+k;pair.position.set(k===0?-.95:.95,.34,0);subject.add(pair);pairs.push(pair)
    const wood=new THREE.MeshStandardMaterial({color:k===0?'#8f5037':'#b87945',roughness:.38}),cut=new THREE.MeshStandardMaterial({color:'#d8b383',roughness:.67})
    lower.push(mesh('cast-shell-lower-'+k,shellGeometry(false),[wood,cut],pair))
    const pivot=new THREE.Group();pivot.name='cast-pivot-'+k;pivot.position.z=-.96;pair.add(pivot);pivots.push(pivot)
    const top=mesh('cast-shell-upper-'+k,shellGeometry(true),[wood,cut],pivot);top.position.z=.96;upper.push(top)
    for(const side of [-1,1])for(const isUpper of [false,true]) {
      const eye=mesh('cast-eye-'+k+'-'+side+'-'+isUpper,new THREE.TorusGeometry(.09,.025,8,32),wood,isUpper?pivot:pair)
      eye.rotation.x=Math.PI/2;eye.position.set(side*.17,isUpper?.055:-.055,isUpper?0:-.96);eyes.push(eye)
    }
    const g=new THREE.BufferGeometry(),segments=128,sides=6,positions=new Float32Array((segments+1)*(sides+1)*3),index:number[]=[]
    for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;index.push(a,a+1,b,b,a+1,b+1)}
    g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setIndex(index);cords.push(mesh('cast-cord-'+k,g,cordMaterial,pair))
  }
  function updateCord(k:number) {
    const pivot=pivots[k]!,x=.17,p=(side:number)=>new THREE.Vector3(side*x,.055,0).applyEuler(pivot.rotation).add(pivot.position),left=p(-1),right=p(1),normal=new THREE.Vector3(0,.16,0).applyEuler(pivot.rotation)
    const points=[new THREE.Vector3(-x,-.055,-.96),left,left.clone().add(normal),right.clone().add(normal),right,new THREE.Vector3(x,-.055,-.96),new THREE.Vector3(x,-.215,-.96),new THREE.Vector3(-x,-.215,-.96)]
    const curve=new THREE.CatmullRomCurve3(points,true,'centripetal'),g=cords[k]!.geometry,a=g.getAttribute('position'),tangent=new THREE.Vector3(),u=new THREE.Vector3(1,0,0),v=new THREE.Vector3(),center=new THREE.Vector3()
    for(let i=0;i<=128;i++) {
      curve.getPoint(i/128,center);curve.getTangent(i/128,tangent);u.set(1,0,0);if(Math.abs(tangent.x)>.9)u.set(0,0,1);u.addScaledVector(tangent,-u.dot(tangent)).normalize();v.crossVectors(tangent,u).normalize()
      for(let j=0;j<=6;j++){const angle=j/6*Math.PI*2,p=center.clone().addScaledVector(u,.012*Math.cos(angle)).addScaledVector(v,.012*Math.sin(angle));a.setXYZ(i*7+j,p.x,p.y,p.z)}
    }
    // Closed curves use a wrapped endpoint ring; one-sided endpoint tangents otherwise leave a tiny crack.
    for(let j=0;j<=6;j++)a.setXYZ(128*7+j,a.getX(j),a.getY(j),a.getZ(j))
    a.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere()
    // Actual interpolation knots pass through all four open eyelet centres.
    for(const i of [0,1,4,5])cordPoints.push(curve.getPoint(i/8).applyMatrix4(pairs[k]!.matrixWorld))
  }
  const pose=(step:number,n:number)=>{
    const t=THREE.MathUtils.clamp(n,0,1),pulse=t<=.65?t/.65:(1-t)/.35
    for(let k=0;k<2;k++)pivots[k]!.rotation.x=-.55*(1-((step===k||step===2)&&step<3?pulse:0))
    subject.updateMatrixWorld(true);cordPoints=[];for(let k=0;k<2;k++)updateCord(k)
  }
  pose(0,0)
  return {subject,pairs,pivots,upper,lower,eyes,cords,get cordPoints(){return cordPoints},pose,targets:[upper[0]!,upper[1]!,upper[0]!],roots:[upper[0]!,upper[1]!,upper[0]!],anchors:[[0,.30,.30],[0,.30,.30],[0,.30,.30]] as [number,number,number][]}
}
