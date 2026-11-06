// Reused from the frozen Komorebi snapshot; see assets/environments/komorebi.
import {environmentHash as hash,MEADOW_GRASS_RADIUS} from './meadow-layout';
import {sampleMeadowField} from './meadow-field';
export type MeadowBiome='meadow'|'woodland'|'upland';
export interface MeadowGeometry{positions:number[];indices:number[];colors:number[]}
type RGB=[number,number,number];
const hex=(value:string):RGB=>{const s=/^#[\da-f]{6}$/i.test(value)?value:'#74a951';return [1,3,5].map(i=>parseInt(s.slice(i,i+2),16)/255) as RGB;};
const mix=(a:RGB,b:RGB,t:number):RGB=>a.map((v,i)=>v+(b[i]-v)*t) as RGB;
const shade=(color:RGB,value:number):RGB=>color.map(v=>Math.min(1,Math.max(0,v*value))) as RGB;

/** A coherent world-scale color field, rather than independent random green speckles. */
export function meadowSurfaceTint(x:number,z:number,seed=0):number{return sampleMeadowField(x,z,seed).tone;}
/** The red/green ratio changes across the meadow, rather than only its brightness. */
export function meadowInstanceTint(x:number,z:number,seed=0):number[]{
  const {tone,dry}=sampleMeadowField(x,z,seed);
  return [.75+tone*.35+dry*.1,.82+tone*.18-dry*.04,.74-tone*.25+dry*.1,1];
}

/** Nine curved ribbon profiles, mixing a short understorey with sparse taller tips. */
export function createMeadowGrass(variant:number,baseHex:string,biome:MeadowBiome):MeadowGeometry{
  const data:MeadowGeometry={positions:[],indices:[],colors:[]},base=hex(baseHex);
  const root=mix(base,hex(biome==='upland'?'#626337':'#34582d'),.7);
  const middle=mix(base,hex(biome==='woodland'?'#69935a':biome==='upland'?'#a1a156':'#829e46'),.65);
  const tip=mix(base,hex(biome==='woodland'?'#a1bd7a':biome==='upland'?'#ccc084':'#bdce78'),.75);
  const blades=40+(variant%3)*6;
  for(let i=0;i<blades;i++){
    const angle=hash(i,variant,130)*Math.PI*2,radial=i*2.399963+variant*.73;
    const radius=Math.sqrt((i+.4)/blades)*(MEADOW_GRASS_RADIUS-.095);
    const x=Math.cos(radial)*radius,z=Math.sin(radial)*radius;
    const h=hash(i,variant,133),height=i%11===0?.285+h*.06:i%5===0?.07+h*.045:.13+h*.13;
    const width=.009+hash(i,variant,134)*.011,bend=.025+hash(i,variant,135)*.055;
    const sx=Math.cos(angle)*width,sz=Math.sin(angle)*width,dx=Math.sin(angle)*bend,dz=Math.cos(angle)*bend;
    const offset=data.positions.length/3,tone=.86+hash(i,variant,136)*.2;
    const dry=hash(i,variant,137)>.93?.3:0;
    for(const t of [0,.42,.78]){
      const taper=Math.pow(1-t,1.1),arc=t*t;
      const color=mix(root,t<.5?mix(middle,hex('#aca462'),dry):mix(tip,hex('#d1c480'),dry),t===0?0:t<.5?.85:1);
      for(const side of [-1,1]){
        data.positions.push(x+dx*arc+sx*taper*side,t===0?-.012:height*t,z+dz*arc+sz*taper*side);
        data.colors.push(...shade(color,tone),1);
      }
    }
    data.positions.push(x+dx,height,z+dz);data.colors.push(...shade(mix(tip,hex('#d1c480'),dry),tone),1);
    data.indices.push(...[0,2,1,1,2,3,2,4,3,3,4,5,4,6,5].map(n=>n+offset));
  }
  return data;
}
