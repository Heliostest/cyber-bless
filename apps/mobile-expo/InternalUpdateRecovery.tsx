import {useEffect,useRef,useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import type {InternalUpdateAction,InternalUpdateError,InternalUpdateHost,InternalUpdateState} from '@wbr/runtime';

const errorKeys:Record<InternalUpdateError,string>={invitation:'invitation',incompatible:'incompatible',network:'network','not-downloaded':'missing',unsafe:'unsafe',save:'save',reload:'reload'};

/** Native-only repair controls. The shell must stop the failed DOM first;
 * the host owns foreground checks, durable writes and the reload barrier. */
export function InternalUpdateRecovery({host,copy}:{host:InternalUpdateHost;copy:Record<string,string>}) {
  const [state,setState]=useState<InternalUpdateState>();
  const [operation,setOperation]=useState<InternalUpdateAction>();
  const [error,setError]=useState<InternalUpdateError>();
  const [checked,setChecked]=useState(false);
  const alive=useRef(false),pending=useRef(false),generation=useRef(0);
  const label=(key:string)=>copy[`native.update.${key}`]??'';
  useEffect(()=>{
    alive.current=true;const version=++generation.current;
    void host.request('status').then(value=>{if(alive.current&&version===generation.current)setState(value)}).catch(()=>{if(alive.current&&version===generation.current)setError('network')});
    return()=>{alive.current=false;generation.current++};
  },[host]);
  useEffect(()=>{
    if(operation!=='download'&&state?.phase!=='downloading'&&state?.phase!=='checking')return;
    const version=generation.current;
    const timer=setInterval(()=>{
      void host.request('status').then(value=>{if(alive.current&&version===generation.current)setState(value)}).catch(()=>{});
    },750);
    return()=>clearInterval(timer);
  },[host,operation,state?.phase]);
  async function run(action:InternalUpdateAction){
    if(pending.current||state?.phase==='applying')return;
    pending.current=true;const version=++generation.current;setOperation(action);setError(undefined);
    try{const value=await host.request(action);if(alive.current&&version===generation.current){setState(value);if(action==='check'&&!value.error)setChecked(true)}}
    catch{if(alive.current&&version===generation.current)setError(action==='apply'?'reload':'network')}
    finally{pending.current=false;if(alive.current&&version===generation.current){setOperation(undefined);generation.current++}}
  }
  const busy=!!operation||state?.phase==='applying'||state?.phase==='checking'||state?.phase==='downloading';
  const failure=error??state?.error;
  const phase=state?.phase;
  const downloading=operation==='download'||phase==='downloading';
  const status=operation==='check'||phase==='checking'?'checking':downloading?'downloading':phase==='ready'?'ready':phase==='idle'&&checked?'latest':undefined;
  const button=(action:'check'|'download'|'apply')=><Pressable key={action} accessibilityRole="button" accessibilityLabel={label(action)} accessibilityState={{disabled:busy}} disabled={busy} style={styles.button} onPress={()=>void run(action)}><Text style={styles.buttonText}>{label(action)}</Text></Pressable>;
  return <View style={styles.panel}>
    {state?.available?.kind==='update'&&<View>
      <Text style={styles.message}>{state.available.sourceCommit?.slice(0,8)??state.available.id.slice(0,8)}</Text>
      <Text style={styles.message}>{state.available.message}</Text>
    </View>}
    {status&&<Text accessibilityLiveRegion="polite" style={styles.message}>{label(status)}</Text>}
    {downloading&&<Text accessibilityRole="progressbar" accessibilityValue={{min:0,max:100,now:Math.round((state?.progress??0)*100)}} style={styles.message}>{Math.round((state?.progress??0)*100)}%</Text>}
    {failure&&<Text accessibilityRole="alert" style={styles.message}>{label(errorKeys[failure])}</Text>}
    {state?.enabled!==false&&<View style={styles.actions}>
      {button('check')}
      {state?.available&&button('download')}
      {state?.downloaded&&(!state.available||state.available.id===state.downloaded.id)&&button('apply')}
    </View>}
  </View>;
}

const styles=StyleSheet.create({
  panel:{alignSelf:'stretch',gap:12},actions:{gap:12},
  message:{color:'#4a2a12',textAlign:'center',lineHeight:24},
  button:{minHeight:44,padding:12,borderRadius:16,backgroundColor:'#4fd8c9',alignItems:'center',justifyContent:'center'},
  buttonText:{color:'#064a43',fontWeight:'700',textAlign:'center'},
});
