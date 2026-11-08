export type InternalUpdateCandidate = {
  id: string;
  runtimeVersion: string;
  kind: 'update' | 'embedded';
  message: string;
  sourceCommit?: string;
  sourceTree?: string;
  createdAt?: string;
};
export type InternalUpdateIdentity = {
  id: string | null;
  runtimeVersion: string | null;
  embedded: boolean;
  sourceCommit?: string;
  sourceTree?: string;
};
export type InternalUpdateAction = 'status' | 'check' | 'download' | 'apply';
export type InternalUpdateError = 'invitation' | 'incompatible' | 'network' | 'not-downloaded' | 'unsafe' | 'save' | 'reload';
export type InternalUpdateState = {
  enabled: boolean;
  phase: 'unavailable' | 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'applying' | 'error';
  current: InternalUpdateIdentity;
  available?: InternalUpdateCandidate;
  downloaded?: InternalUpdateCandidate;
  progress?: number;
  error?: InternalUpdateError;
};
/** Values crossing the native/DOM boundary are JSON only. */
export type InternalUpdateHost = { request(action: InternalUpdateAction): Promise<InternalUpdateState> };
export type InternalUpdateAdapter = {
  enabled(): boolean;
  current(): InternalUpdateIdentity;
  readInvitation(): Promise<string>;
  authorize(invitation: string): void;
  check(): Promise<InternalUpdateCandidate | undefined>;
  download(): Promise<InternalUpdateCandidate | undefined>;
  canApply(): boolean;
  flushWrites(): Promise<void>;
  reload(): Promise<void>;
};

/** Native verification owns transport and files. This controller owns explicit
 * operations and the save/safety barrier; raw exception text never crosses it. */
export function createInternalUpdateController(adapter: InternalUpdateAdapter) {
  let state:InternalUpdateState={enabled:adapter.enabled(),phase:adapter.enabled()?'idle':'unavailable',current:adapter.current()};
  let busy=false;
  const snapshot=():InternalUpdateState=>({...state,current:{...state.current},available:state.available?{...state.available}:undefined,downloaded:state.downloaded?{...state.downloaded}:undefined});
  const fail=(error:InternalUpdateError)=>{state={...state,phase:'error',error};return snapshot()};
  const compatible=(candidate:InternalUpdateCandidate)=>candidate.runtimeVersion===state.current.runtimeVersion
    && !!candidate.runtimeVersion && (candidate.kind==='embedded'&&candidate.id==='embedded'||candidate.kind==='update'&&/^[a-f\d-]{36}$/i.test(candidate.id));
  async function authorize() {
    const token=(await adapter.readInvitation()).trim();
    if(!token||token.length>256)return false;
    adapter.authorize(token);return true;
  }
  return {
    updateProgress(progress:number){if(state.phase==='downloading'&&Number.isFinite(progress))state={...state,progress:Math.max(0,Math.min(1,progress))}},
    async request(action:InternalUpdateAction):Promise<InternalUpdateState>{
      if(!adapter.enabled()){state={enabled:false,phase:'unavailable',current:adapter.current()};return snapshot()}
      if(action==='status'||busy)return snapshot();
      if(!['check','download','apply'].includes(action))return snapshot();
      busy=true;
      try{
        state={...state,error:undefined,progress:undefined};
        if(action==='apply'){
          if(!state.downloaded||state.available&&state.available.id!==state.downloaded.id)return fail('not-downloaded');
          if(!adapter.canApply())return fail('unsafe');
          state={...state,phase:'applying'};
          try{await adapter.flushWrites()}catch{return fail('save')}
          if(!adapter.canApply())return fail('unsafe');
          try{await adapter.reload()}catch{return fail('reload')}
          // The native runtime may resolve just before it tears JS down. Keep
          // the operation locked instead of allowing a second reload or input.
          return snapshot();
        }
        state={...state,phase:action==='check'?'checking':'downloading',...(action==='download'?{progress:0}:{})};
        try{if(!await authorize())return fail('invitation')}catch{return fail('invitation')}
        let candidate:InternalUpdateCandidate|undefined;
        try{candidate=await (action==='check'?adapter.check():adapter.download())}catch{return fail('network')}
        if(candidate&&!compatible(candidate))return fail('incompatible');
        if(action==='check'){
          state={...state,available:candidate,phase:candidate?'available':state.downloaded?'ready':'idle'};
        }else{
          if(!candidate)return fail('not-downloaded');
          state={...state,available:candidate,downloaded:candidate,phase:'ready',progress:1};
        }
        return snapshot();
      }finally{busy=state.phase==='applying'}
    },
  };
}
