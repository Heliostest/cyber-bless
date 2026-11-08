import {useEffect,useRef,useState} from 'react';
import {getFormatLocale,translate as tr} from '@wbr/i18n';
import type {FeedbackHistoryPage} from '@wbr/shared/test-feedback';
import './feedback-history.css';

export const HISTORY_COPY={
 title:'历史反馈',intro:'包含旧版本及已修复的问题，供本次复测对照。',
 loading:'正在读取历史反馈…',empty:'还没有这个仪式的问题反馈。',error:'历史反馈暂时无法读取，请重试。',
 cached:'当前显示上次读取的记录，处理状态可能已变化。',refresh:'刷新历史',more:'加载更早反馈',
 setup:'填写上传网址和邀请码后，可查看历史反馈。',
 new:'待处理',triaged:'处理中',fixed:'已修复，待核对',
 version:'反馈版本：{p0}',step:'第 {p0} / {p1} 步',same:'与当前修订相同',other:'来自其他修订',unknown:'未记录修订',
 instruction:'当时的提示：{p0}',received:'接收于 {p0}',revision:'修订 {p0}',
};
type View=Pick<FeedbackHistoryPage,'items'|'nextCursor'|'generatedAt'>;
export function FeedbackHistoryPanel({sceneId,currentRevision,readHistory,autoOpen=false,enabled=true}:{sceneId:string;currentRevision:string;readHistory(sceneId:string,cursor?:string):Promise<FeedbackHistoryPage>;autoOpen?:boolean;enabled?:boolean}){
 const [expanded,setExpanded]=useState(autoOpen),[page,setPage]=useState<View>(),[busy,setBusy]=useState(false),[error,setError]=useState(false);
 const alive=useRef(false),generation=useRef(0),pending=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;generation.current++}},[]);
 useEffect(()=>{if(autoOpen)setExpanded(true)},[autoOpen]);
 async function load(cursor?:string){
  if(pending.current||!enabled)return;
  pending.current=true;const version=++generation.current;setBusy(true);setError(false);
  try{
   const value=await readHistory(sceneId,cursor);
   if(alive.current&&version===generation.current)setPage(previous=>({...value,items:cursor?[...new Map([...(previous?.items??[]),...value.items].map(item=>[item.id,item])).values()]:value.items}));
  }catch{if(alive.current&&version===generation.current)setError(true)}
  finally{if(alive.current&&version===generation.current){pending.current=false;setBusy(false)}}
 }
 useEffect(()=>{
  if(expanded&&enabled)void load();else setBusy(false);
  return()=>{generation.current++;pending.current=false};
 },[expanded,sceneId,readHistory,enabled]);
 const date=(value:string)=>new Intl.DateTimeFormat(getFormatLocale(),{dateStyle:'short',timeStyle:'short'}).format(new Date(value));
 return <section className="feedback-history">
  <h3><button type="button" className="text-button" data-history-action="toggle" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>{tr(HISTORY_COPY.title)}</button></h3>
  {expanded&&<div>
   <p className="quiet">{tr(HISTORY_COPY.intro)}</p>
   {!enabled?<p>{tr(HISTORY_COPY.setup)}</p>:<>
    <div className="feedback-history-actions"><button type="button" className="button secondary" data-history-action="refresh" disabled={busy} onClick={()=>void load()}>{tr(HISTORY_COPY.refresh)}</button></div>
    {busy&&<p role="status">{tr(HISTORY_COPY.loading)}</p>}
    {error&&<p role="alert">{tr(HISTORY_COPY.error)}</p>}
    {error&&page&&<p className="quiet">{tr(HISTORY_COPY.cached)}</p>}
    {page&&!page.items.length&&!error&&!busy&&<p>{tr(HISTORY_COPY.empty)}</p>}
    {!!page?.items.length&&<ol className="feedback-history-list" aria-label={tr(HISTORY_COPY.title)} tabIndex={0}>{page.items.map(item=><li className="feedback-history-item" key={item.id}>
     <div className="feedback-history-heading"><strong data-feedback-status={item.status}>{tr(HISTORY_COPY[item.status])}</strong><time dateTime={item.receivedAt}>{tr(HISTORY_COPY.received,{p0:date(item.receivedAt)})}</time></div>
     <p className="feedback-history-message">{item.message}</p>
     <p>{tr(HISTORY_COPY.step,{p0:item.reportedStep,p1:item.totalSteps})}</p>
     {item.instruction&&<p className="quiet">{tr(HISTORY_COPY.instruction,{p0:item.instruction})}</p>}
     <p className="quiet">{tr(HISTORY_COPY.version,{p0:`${item.platform==='ios'?'iOS':item.platform==='android'?'Android':'Web'} ${item.appVersion} (${item.buildNumber})`})}</p>
     <p className="quiet">{tr(item.testingRevision?item.testingRevision===currentRevision?HISTORY_COPY.same:HISTORY_COPY.other:HISTORY_COPY.unknown)} · {tr(HISTORY_COPY.revision,{p0:item.testingRevision?.slice(0,8)??item.revision})}{item.updateSourceCommit?` · ${item.updateSourceCommit.slice(0,8)}`:''}</p>
    </li>)}</ol>}
    {page?.nextCursor&&<button type="button" className="button secondary" data-history-action="more" disabled={busy} onClick={()=>void load(page.nextCursor)}>{tr(HISTORY_COPY.more)}</button>}
   </>}
  </div>}
 </section>;
}
