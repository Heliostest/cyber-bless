// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {FeedbackHistoryPanel} from './feedback-history-panel';
import type {FeedbackHistoryPage} from '@wbr/shared/test-feedback';
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
let root:Root|undefined;afterEach(()=>{act(()=>root?.unmount());document.body.innerHTML=''});
const item={id:'history-issue-001',createdAt:'2026-11-01T08:00:00.000Z',receivedAt:'2026-11-02T08:00:00.000Z',updatedAt:'2026-11-03T08:00:00.000Z',status:'fixed' as const,message:'<img src=x onerror=alert(1)> 第二步拖动没有反应',reportedStep:2,totalSteps:3,revision:'bundled',testingRevision:'a'.repeat(64),platform:'ios' as const,appVersion:'1.0.0',buildNumber:'28'};
const page:FeedbackHistoryPage={schemaVersion:1,sceneId:'crane',generatedAt:item.updatedAt,items:[item],nextCursor:'nextPage'};
async function mount(load:(scene:string,cursor?:string)=>Promise<FeedbackHistoryPage>){const host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(async()=>{root!.render(<FeedbackHistoryPanel sceneId="crane" currentRevision={'b'.repeat(64)} readHistory={load} autoOpen/>)});return host;}
async function click(host:HTMLElement,action:string){await act(async()=>{(host.querySelector(`[data-history-action="${action}"]`) as HTMLButtonElement).click()})}
it('shows old fixed feedback, step/version and safe text, then appends the next page',async()=>{
 const load=vi.fn(async(_scene:string,cursor?:string)=>cursor?{...page,nextCursor:undefined,items:[{...item,id:'history-issue-002',message:'更早的意见'}]}:page);
 const host=await mount(load);expect(host.textContent).toContain('已修复，待核对');expect(host.textContent).toContain('第 2 / 3 步');expect(host.textContent).toContain('1.0.0 (28)');expect(host.textContent).toContain('来自其他修订');expect(host.textContent).toContain(item.message);expect(host.querySelector('img')).toBeNull();
 await click(host,'more');expect(load).toHaveBeenLastCalledWith('crane','nextPage');expect(host.textContent).toContain('更早的意见');expect(host.querySelectorAll('.feedback-history-item')).toHaveLength(2);
});
it('keeps the last fetched comments on failure and refreshes without claiming empty history',async()=>{
 const load=vi.fn(async()=>page);const host=await mount(load);load.mockRejectedValueOnce(Error('offline private error'));
 await click(host,'refresh');expect(host.textContent).toContain(item.message);expect(host.textContent).toContain('当前显示上次读取的记录');expect(host.textContent).not.toContain('private error');expect(host.textContent).not.toContain('还没有这个仪式');
});
it('shows an unavailable old receiver as an error and allows retry instead of claiming no feedback',async()=>{
 const load=vi.fn(async():Promise<FeedbackHistoryPage>=>{throw Error('404')});const host=await mount(load);
 expect(host.querySelector('[role=alert]')?.textContent).toBe('历史反馈暂时无法读取，请重试。');expect(host.textContent).not.toContain('还没有这个仪式');
 load.mockResolvedValueOnce(page);await click(host,'refresh');expect(host.textContent).toContain(item.message);expect(host.querySelector('[role=alert]')).toBeNull();
});
it('drops late replies when the history panel is replaced by another scene',async()=>{
 let finish!:(page:FeedbackHistoryPage)=>void;
 const host=await mount(()=>new Promise(resolve=>{finish=resolve}));
 await act(async()=>{root!.render(<FeedbackHistoryPanel key="woodfish" sceneId="woodfish" currentRevision={'b'.repeat(64)} readHistory={async()=>({...page,sceneId:'woodfish',items:[],nextCursor:undefined})} autoOpen/>)});
 await act(async()=>{finish(page)});expect(host.textContent).not.toContain(item.message);expect(host.textContent).toContain('还没有这个仪式');
});
