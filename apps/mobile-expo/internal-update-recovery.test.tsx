// @vitest-environment jsdom
import {act,createElement} from 'react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {createInternalUpdateController,type InternalUpdateCandidate} from '@wbr/runtime';
import {renderUI,settle,clickOn} from '../../packages/app/src/dom-test-utils';
import {InternalUpdateRecovery} from './InternalUpdateRecovery';

vi.mock('react-native',async()=>{
  const {createElement:h}=await import('react');
  return {
    View:({children}:any)=>h('div',{},children),
    Text:({children,accessibilityRole}:any)=>h('span',{role:accessibilityRole},children),
    Pressable:({children,onPress,disabled,accessibilityLabel,style}:any)=>h('button',{onClick:onPress,disabled,'aria-label':accessibilityLabel,style},children),
    StyleSheet:{create:(value:unknown)=>value},
  };
});
const copy=Object.fromEntries(['check','download','apply','checking','downloading','ready','latest','invitation','incompatible','network','missing','unsafe','save','reload'].map(key=>['native.update.'+key,key]));
const rollback:InternalUpdateCandidate={id:'embedded',kind:'embedded',runtimeVersion:'native-1',message:''};
const press=async(ui:ReturnType<typeof renderUI>,label:string)=>{await act(async()=>{clickOn(ui.host.querySelector(`[aria-label="${label}"]`)!)});await settle()};
const views:ReturnType<typeof renderUI>[]=[];
afterEach(()=>{for(const ui of views.splice(0))ui.unmount();vi.useRealTimers();document.body.replaceChildren()});
function mount(overrides:Record<string,unknown>={}){
  const adapter={enabled:()=>true,current:()=>({id:null,runtimeVersion:'native-1',embedded:true}),readInvitation:async()=> 'invite',authorize:vi.fn(),check:vi.fn(async()=>rollback),download:vi.fn(async()=>rollback),canApply:()=>true,flushWrites:vi.fn(async()=>{}),reload:vi.fn(async()=>{}),...overrides};
  const host=createInternalUpdateController(adapter);
  const ui=renderUI(createElement(InternalUpdateRecovery,{host,copy}));views.push(ui);return{ui,adapter,host};
}
describe('native update recovery',()=>{
  it('repairs a failed DOM through separate explicit embedded rollback actions and the save barrier',async()=>{
    let saved!:()=>void;
    const {ui,adapter}=mount({flushWrites:()=>new Promise<void>(resolve=>{saved=resolve})});await settle();
    expect(adapter.check).not.toHaveBeenCalled();expect(adapter.download).not.toHaveBeenCalled();
    await press(ui,'check');expect(adapter.download).not.toHaveBeenCalled();
    await press(ui,'download');expect(adapter.reload).not.toHaveBeenCalled();
    await press(ui,'apply');expect(adapter.reload).not.toHaveBeenCalled();
    expect(ui.host.querySelector<HTMLButtonElement>('[aria-label="check"]')!.disabled).toBe(true);
    await act(async()=>saved());await settle();expect(adapter.reload).toHaveBeenCalledOnce();
    expect(ui.host.querySelector<HTMLButtonElement>('[aria-label="apply"]')!.disabled).toBe(true);
  });
  it('keeps errors bounded, permits retry and renders repair notes as text',async()=>{
    const repaired={...rollback,id:'4ca724b7-a28e-4355-81ac-bb4ed70838e5',kind:'update' as const,message:'<img src=x onerror=secret()>',sourceCommit:'a'.repeat(40)};
    const {ui,adapter}=mount();adapter.check.mockRejectedValueOnce(Error('private-token-secret'));await settle();await press(ui,'check');
    expect(ui.host.textContent).toContain('network');expect(ui.host.textContent).not.toContain('private-token-secret');
    adapter.check.mockResolvedValueOnce(repaired);await press(ui,'check');
    expect(ui.host.textContent).toContain(repaired.message);expect(ui.host.querySelector('img')).toBeNull();expect(ui.host.textContent).toContain('aaaaaaaa');
    expect(ui.host.querySelector('button')!.style.minHeight).toBe('44px');
  });
  it('polls download progress without initiating another download and stops when unmounted',async()=>{
    let done!:(candidate:InternalUpdateCandidate)=>void;
    const {ui,host,adapter}=mount({download:vi.fn(()=>new Promise<InternalUpdateCandidate>(resolve=>{done=resolve}))});await settle();await press(ui,'check');await press(ui,'download');
    host.updateProgress(.5);
    await act(async()=>{await new Promise(resolve=>setTimeout(resolve,800))});
    expect(ui.host.textContent).toContain('50%');expect(adapter.download).toHaveBeenCalledOnce();
    ui.unmount();views.splice(views.indexOf(ui),1);await act(async()=>done(rollback));
    expect(adapter.reload).not.toHaveBeenCalled();
  });
});
