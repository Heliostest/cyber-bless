/** Original deterministic growth fields. No renderer or layout imports. */
export interface MeadowField {density:number;height:number;tone:number;dry:number}
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const ease=(x:number)=>{const t=clamp(x);return t*t*t*(t*(t*6-15)+10);};
function hash(x:number,z:number,seed:number):number{
  const n=Math.sin(x*127.1+z*311.7+seed*74.7)*43758.5453;return n-Math.floor(n);
}
function noise(x:number,z:number,seed:number):number{
  const ix=Math.floor(x),iz=Math.floor(z),u=ease(x-ix),v=ease(z-iz);
  const a=hash(ix,iz,seed),b=hash(ix+1,iz,seed),c=hash(ix,iz+1,seed),d=hash(ix+1,iz+1,seed);
  return (a+(b-a)*u)*(1-v)+(c+(d-c)*u)*v;
}
export function sampleMeadowField(x:number,z:number,seed=0):MeadowField{
  const coverage=noise(x*.32+8.7,z*.32-3.2,seed+31)*.76+noise(x*.93,z*.93,seed+57)*.24;
  const height=noise(x*.37-4.1,z*.37+9.8,seed+83)*.8+noise(x*1.1,z*1.1,seed+97)*.2;
  const pigment=noise(x*.22+3.7,z*.22-8.1,seed+113)*.72+noise(x*.68,z*.68,seed+131)*.28;
  return {density:.2+.78*ease((coverage-.18)/.64),height:.48+1.16*ease((height-.16)/.68),tone:ease((pigment-.16)/.68),
    dry:ease((noise(x*.57+11,z*.57-6,seed+149)-.55)/.4)*.35};
}
