/** Offline EZ Tree adapter. Runtime imports only the generated JSON, never Three.js. */
import {writeFileSync} from 'node:fs';
import {Tree} from './vendor/ez-tree/tree.mjs';
import {Quaternion,Vector3} from 'three';

const profiles = [
  {name:'rounded',seed:4217,trunk:4.2,spread:3.3,angle:52,start:.4,height:3.45,width:1.00},
  {name:'spreading',seed:9318,trunk:3.7,spread:3.8,angle:67,start:.43,height:3.05,width:1.08},
  {name:'upright',seed:1271,trunk:5.5,spread:2.6,angle:35,start:.36,height:4.00,width:.86},
  {name:'leaning',seed:7133,trunk:4.3,spread:3.3,angle:58,start:.36,height:3.5,width:1.02},
  {name:'low',seed:2843,trunk:3.1,spread:3.6,angle:62,start:.28,height:2.65,width:1.04},
  {name:'forked',seed:5729,trunk:4.2,spread:3.2,angle:39,start:.17,height:3.6,width:.98},
];
const trunks = [
  {style:'gentle-s',radius:.101,flare:.024,fork:1.70,azimuth:.6,lean:.018,sway:.027,upperLean:.12,upperSway:-.09},
  {style:'stout-crooked',radius:.112,flare:.025,fork:1.59,azimuth:2.2,lean:-.020,sway:-.025,upperLean:.22,upperSway:.09},
  {style:'slender',radius:.071,flare:.023,fork:1.86,azimuth:4.1,lean:.012,sway:.018,upperLean:-.09,upperSway:.045},
  {style:'leaning',radius:.090,flare:.025,fork:1.66,azimuth:3.5,lean:.028,sway:.016,upperLean:.32,upperSway:.04},
  {style:'gnarled',radius:.108,flare:.027,fork:1.58,azimuth:5.2,lean:.020,sway:.031,upperLean:-.16,upperSway:.11},
  {style:'forked',radius:.103,flare:.025,fork:1.62,azimuth:1.3,lean:-.025,sway:.025,upperLean:.18,upperSway:-.12},
];
const round=n=>Math.round(n*10000)/10000;
const random=(seed,salt)=>{const value=Math.sin(seed*127.1+salt*311.7)*43758.5453;return value-Math.floor(value);};
const trees=profiles.map((profile,index)=>{
  const tree=new Tree(),o=tree.options,body=trunks[index];
  o.seed=profile.seed;o.branch.levels=3;
  o.branch.length={0:profile.trunk,1:profile.spread,2:1.05,3:.55};
  o.branch.radius={0:.115,1:.64,2:.6,3:.5};
  o.branch.angle={1:profile.angle,2:65,3:58};o.branch.children={0:7,1:4,2:3};
  o.branch.start={1:profile.start,2:.32,3:.15};
  o.branch.sections={0:9,1:6,2:3,3:2};o.branch.segments={0:8,1:5,2:3,3:3};
  o.branch.gnarliness={0:.012,1:.038,2:.034,3:.018};
  o.branch.force={direction:{x:index===3?.24:0,y:1,z:index===3?.12:0},strength:.001};
  o.leaves.count=1;o.leaves.size=.1;o.bark.textured=false;
  // Vary individual limbs in the adapter, keeping the pinned upstream source untouched.
  // A mix of ascending, lateral, arched and shorter limbs breaks the repeated branch cones.
  const growChildren=tree.generateChildBranches.bind(tree);let limb=0;
  tree.generateChildBranches=(count,level,sections)=>{
    const first=tree.branchQueue.length;growChildren(count,level,sections);
    for(const child of tree.branchQueue.slice(first)){
      const seed=profile.seed+limb++*31,mode=Math.floor(random(seed,20)*5);
      const bend=(random(seed,21)-.5)*(level===1?.72:.95)+(level===1?(mode===0?-.42:mode===2?.58:0):0);
      const turn=(random(seed,22)-.5)*.65,roll=(random(seed,23)-.5)*1.3;
      const orientation=new Quaternion().setFromEuler(child.orientation)
        .multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),bend))
        .multiply(new Quaternion().setFromAxisAngle(new Vector3(0,0,1),turn))
        .multiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),roll));
      child.orientation.setFromQuaternion(orientation);
      child.length*=level===1?(mode===3?.62:.78+random(seed,24)*.5):.78+random(seed,24)*.44;
      if(index===5&&level===1&&child===tree.branchQueue[first])child.radius*=1.35;
    }
  };
  const geometry=tree.createGeometry();
  const skeleton=tree.skeleton;
  const maxY=Math.max(...skeleton.leaves.map(l=>l.origin.y));
  const lowestBranchY=Math.min(...skeleton.branches.slice(1).flatMap(b=>b.sections.map(s=>s.origin.y)));
  // All forks and woody overhang stay above pedestrian/trunk-collider height.
  // Remap leaves and branches together so connections and the chosen top height survive.
  const forkHeight=body.fork;
  const firstForkY=Math.min(...skeleton.branches.slice(1,9).map(b=>b.sections[0].origin.y));
  const height=y=>forkHeight+(y-lowestBranchY)/(maxY-lowestBranchY)*(profile.height-.32-forkHeight);
  // Drooping twigs may extend below the original root. Only the trunk shaft uses
  // a grounded lower interval; all branch junctions above the first fork share the same map.
  const shaftHeight=y=>y<firstForkY?y/firstForkY*height(firstForkY):height(y);
  const maxR=Math.max(...skeleton.leaves.map(l=>Math.hypot(l.origin.x,l.origin.z))),scaleXZ=profile.width/maxR;
  const point=(p,shaft=false)=>{
    const y=shaft?shaftHeight(p.y):height(p.y),low=Math.max(0,Math.min(1,y/1.5));
    const high=Math.max(0,(y-1.5)/(profile.height-1.5));
    const bend=body.lean*low+body.sway*Math.sin(low*Math.PI)
      +body.upperLean*high+body.upperSway*Math.sin(high*Math.PI);
    const side=body.sway*.45*Math.sin(low*Math.PI*2)+body.upperSway*.25*Math.sin(high*Math.PI);
    return [round(p.x*scaleXZ+Math.cos(body.azimuth)*bend-Math.sin(body.azimuth)*side),round(y),
      round(p.z*scaleXZ+Math.sin(body.azimuth)*bend+Math.cos(body.azimuth)*side)];
  };
  // Section rings retain connectivity and thickness; the runtime meshes them in Babylon's handedness.
  const branches=skeleton.branches.map((b,branchIndex)=>{
    const sections=branchIndex===0?b.sections.flatMap((s,i)=>i===b.sections.length-1?[s]
      :[0,.25,.5,.75].map(t=>({origin:s.origin.clone().lerp(b.sections[i+1].origin,t),radius:s.radius+(b.sections[i+1].radius-s.radius)*t}))):b.sections;
    return {segments:b.segmentCount,sections:sections.map(s=>{
      const p=point(s.origin,branchIndex===0),taper=.8+.2*Math.exp(-p[1]/.55);
      const flare=branchIndex===0?body.flare*Math.exp(-p[1]/.22):0;
      return {p,r:round(s.radius*body.radius/.115*taper+flare)};
    })};
  });
  const tips=skeleton.leaves.map(l=>point(l.origin));
  const tipDirections=skeleton.leaves.map(l=>{
    const tangent=new Vector3(0,1,0).applyEuler(l.orientation).multiplyScalar(.05);
    const start=point(l.origin),end=point(l.origin.clone().add(tangent));
    return new Vector3(...end).sub(new Vector3(...start)).normalize().toArray().map(round);
  });
  const lobes=skeleton.branches.slice(1,8).map(b=>point(b.sections.at(-1).origin));
  geometry.branches.dispose();geometry.leaves.dispose();
  return {name:profile.name,seed:profile.seed,trunkStyle:body.style,crownBase:forkHeight,branches,tips,tipDirections,lobes};
});
writeFileSync(new URL('../src/data/tree-skeletons.json',import.meta.url),JSON.stringify({source:'EZ Tree',commit:'dcf309bd86bd521083d9c70f01f2de45fdc7c457',trees})+'\n');
console.log(JSON.stringify(trees.map(t=>({name:t.name,branches:t.branches.length,tips:t.tips.length}))));
