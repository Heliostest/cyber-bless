import {useEffect,useRef,useState} from 'react';
import {translate as tr} from '@wbr/i18n';
import type {InternalUpdateAction,InternalUpdateError,InternalUpdateHost,InternalUpdateState} from '@wbr/runtime';
import './internal-updates-panel.css';

const COPY={
  title:'内测更新',intro:'更新场景、交互与素材。下载完成后，可在这里应用。',
  current:'当前版本',embedded:'随安装包版本',available:'可用版本',
  check:'检查更新',download:'下载更新',apply:'应用并重新打开',
  unavailable:'此安装包暂不支持内测更新。',latest:'已是当前内测版本。',
  checking:'正在检查内测更新……',downloading:'正在下载并校验更新……',ready:'更新已准备好，可在这里应用。',
  applying:'正在保存记录并应用更新……',progress:'更新下载进度',
  invitation:'请先在反馈上传设置中填写有效的测试邀请码。',
  incompatible:'这个更新需要新的内测安装包，当前版本可以继续使用。',
  network:'暂时无法获取更新，当前版本可以继续使用，请稍后重试。',
  missing:'请先下载并校验可用更新。',unsafe:'请先返回“我的”并等待保存完成，再应用更新。',
  save:'记录尚未保存成功，更新没有应用，请先重试保存。',reload:'更新暂时没有应用，当前版本已保留，请重试。',
};
const errorCopy:Record<InternalUpdateError,string>={invitation:COPY.invitation,incompatible:COPY.incompatible,network:COPY.network,'not-downloaded':COPY.missing,unsafe:COPY.unsafe,save:COPY.save,reload:COPY.reload};

export function InternalUpdatesPanel({host,apply}:{host:InternalUpdateHost;apply():Promise<InternalUpdateState>}) {
  const [state,setState]=useState<InternalUpdateState>();
  const [operation,setOperation]=useState<InternalUpdateAction>();
  const [failed,setFailed]=useState<InternalUpdateError>();
  const [checked,setChecked]=useState(false);
  const mounted=useRef(false),generation=useRef(0),pending=useRef(false);
  useEffect(()=>{
    mounted.current=true;const version=++generation.current;
    void host.request('status').then(value=>{if(mounted.current&&version===generation.current)setState(value)}).catch(()=>{if(mounted.current)setFailed('network')});
    return()=>{mounted.current=false;generation.current++};
  },[host]);
  useEffect(()=>{
    if(!operation||operation==='apply')return;
    const timer=setInterval(()=>{
      const version=generation.current;
      void host.request('status').then(value=>{if(mounted.current&&pending.current&&version===generation.current)setState(value)}).catch(()=>{});
    },750);
    return()=>clearInterval(timer);
  },[host,operation]);
  async function run(action:InternalUpdateAction) {
    if(pending.current)return;
    pending.current=true;const version=++generation.current;setOperation(action);setFailed(undefined);
    try{
      const result=await (action==='apply'?apply():host.request(action));
      if(mounted.current&&version===generation.current){setState(result);if(action==='check'&&!result.error)setChecked(true)}
    }catch{if(mounted.current)setFailed(action==='apply'?'unsafe':'network')}
    finally{pending.current=false;if(mounted.current){setOperation(undefined);generation.current++}}
  }
  const busy=!!operation||state?.phase==='applying';
  const error=failed??state?.error;
  const status=state?.phase==='applying'?COPY.applying:operation==='check'?COPY.checking:operation==='download'?COPY.downloading:state?.phase==='ready'?COPY.ready:state?.phase==='idle'&&checked?COPY.latest:undefined;
  return <section className="settings-card internal-updates-panel" aria-label={tr(COPY.title)}>
    <h2>{tr(COPY.title)}</h2><p>{tr(COPY.intro)}</p>
    {state&&!state.enabled?<p>{tr(COPY.unavailable)}</p>:<>
      {state&&<p className="internal-update-version">{tr(COPY.current)} · {state.current.embedded?tr(COPY.embedded):state.current.sourceCommit?.slice(0,8)??state.current.id?.slice(0,8)}</p>}
      {state?.available&&<div className="internal-update-release"><strong>{tr(COPY.available)} · {state.available.kind==='embedded'?tr(COPY.embedded):state.available.sourceCommit?.slice(0,8)??state.available.id.slice(0,8)}</strong><p>{state.available.message}</p></div>}
      {operation==='download'&&<progress aria-label={tr(COPY.progress)} value={state?.progress??0} max={1}/>}
      {status&&<p role="status">{tr(status)}</p>}
      {error&&<p className="internal-update-error" role="alert">{tr(errorCopy[error])}</p>}
      <div className="internal-update-actions">
        <button className="button secondary" data-update-action="check" disabled={busy||!state} onClick={()=>void run('check')}>{tr(COPY.check)}</button>
        {state?.available&&<button className="button secondary" data-update-action="download" disabled={busy} onClick={()=>void run('download')}>{tr(COPY.download)}</button>}
        {state?.downloaded&&(!state.available||state.available.id===state.downloaded.id)&&<button className="button" data-update-action="apply" disabled={busy} onClick={()=>void run('apply')}>{tr(COPY.apply)}</button>}
      </div>
    </>}
  </section>;
}
