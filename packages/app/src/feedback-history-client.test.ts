import {it,expect,vi} from 'vitest';
import {createTestFeedbackClient} from './test-feedback-client';
const page={schemaVersion:1,sceneId:'crane',generatedAt:'2026-11-08T08:00:00.000Z',items:[]};
async function fixture(){
 let raw:string|null=null;
 const host={read:async()=>raw,write:vi.fn(async(value:string)=>{raw=value}),send:async()=>'',readStatus:vi.fn(async()=>JSON.stringify(page))};
 const client=createTestFeedbackClient(host);await client.load();await client.setConnection({endpoint:'https://feedback.example',token:'invite'});client.setActive(true);host.write.mockClear();
 return{client,host,disk:()=>raw};
}
it('reads a validated scene history without persisting it or changing the durable outbox',async()=>{
 const f=await fixture();try{
  const before=f.disk();expect((await f.client.readHistory('crane')).items).toEqual([]);
  expect(f.host.readStatus).toHaveBeenCalledWith('https://feedback.example/api/feedback','invite',JSON.stringify({schemaVersion:1,type:'history',sceneId:'crane'}));
  expect(f.host.write).not.toHaveBeenCalled();expect(f.disk()).toBe(before);
 }finally{f.client.dispose()}
});
it('rejects a wrong-scene response and a late response after changing invitation or lifecycle',async()=>{
 const f=await fixture();try{
  f.host.readStatus.mockResolvedValueOnce(JSON.stringify({...page,sceneId:'woodfish'}));await expect(f.client.readHistory('crane')).rejects.toThrow();
  let resolve!:(raw:string)=>void;f.host.readStatus.mockImplementationOnce(()=>new Promise(r=>{resolve=r}));
  const pending=f.client.readHistory('crane');await vi.waitFor(()=>expect(resolve).toBeTypeOf('function'));
  await f.client.setConnection({endpoint:'https://feedback.example',token:'another-invite'});resolve(JSON.stringify(page));await expect(pending).rejects.toThrow();
  f.host.readStatus.mockImplementationOnce(()=>new Promise(r=>{resolve=r}));const background=f.client.readHistory('crane');await Promise.resolve();await Promise.resolve();f.client.setActive(false);f.client.setActive(true);resolve(JSON.stringify(page));await expect(background).rejects.toThrow();
 }finally{f.client.dispose()}
});
