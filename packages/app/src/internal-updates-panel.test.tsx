// @vitest-environment jsdom
import {act,createElement} from 'react';
import {afterEach,describe,it,expect,vi} from 'vitest';
import type {InternalUpdateHost,InternalUpdateState} from '@wbr/runtime';
import {InternalUpdatesPanel} from './internal-updates-panel';
import {clickOn,renderUI,settle} from './dom-test-utils';
import {BlessingApp} from './App';
import {createState} from '@wbr/core';

const current={id:null,runtimeVersion:'native-v1',embedded:true};
const candidate={id:'4ca724b7-a28e-4355-81ac-bb4ed70838e5',runtimeVersion:'native-v1',kind:'update' as const,message:'<img src=x onerror=alert(1)>',sourceCommit:'a'.repeat(40)};
afterEach(()=>{document.body.replaceChildren()});
const press=async(element:Element)=>{await act(async()=>{clickOn(element);await Promise.resolve()});await settle()};
describe('internal update panel',()=>{
  it('uses explicit check/download/apply actions and renders release notes as text',async()=>{
    let state:InternalUpdateState={enabled:true,phase:'idle',current};
    const host:InternalUpdateHost={request:vi.fn(async action=>{
      if(action==='check')state={...state,phase:'available',available:candidate};
      if(action==='download')state={...state,phase:'ready',downloaded:candidate};
      return state;
    })};
    const apply=vi.fn(async()=>({...state,phase:'applying' as const}));
    const ui=renderUI(createElement(InternalUpdatesPanel,{host,apply}));await settle();
    await press(ui.host.querySelector('[data-update-action="check"]')!);
    expect(ui.host.textContent).toContain(candidate.message);expect(ui.host.querySelector('img')).toBeNull();expect(apply).not.toHaveBeenCalled();
    await press(ui.host.querySelector('[data-update-action="download"]')!);expect(apply).not.toHaveBeenCalled();
    await press(ui.host.querySelector('[data-update-action="apply"]')!);expect(apply).toHaveBeenCalledOnce();ui.unmount();
  });
  it('shows only the bounded public error and recovers with a new check',async()=>{
    let failed=true;
    const host:InternalUpdateHost={request:vi.fn(async action=>action==='status'?{enabled:true,phase:'idle',current}:failed?{enabled:true,phase:'error',current,error:'invitation'}:{enabled:true,phase:'idle',current})};
    const ui=renderUI(createElement(InternalUpdatesPanel,{host,apply:vi.fn()}));await settle();
    await press(ui.host.querySelector('[data-update-action="check"]')!);expect(ui.host.querySelector('[role="alert"]')).not.toBeNull();
    failed=false;await press(ui.host.querySelector('[data-update-action="check"]')!);expect(ui.host.querySelector('[role="alert"]')).toBeNull();ui.unmount();
  });
  it('does not offer download or apply in an unsupported native build',async()=>{
    const host:InternalUpdateHost={request:async()=>({enabled:false,phase:'unavailable',current})};
    const ui=renderUI(createElement(InternalUpdatesPanel,{host,apply:vi.fn()}));await settle();
    expect(ui.host.querySelector('[data-update-action="download"]')).toBeNull();expect(ui.host.querySelector('[data-update-action="apply"]')).toBeNull();ui.unmount();
  });
  it('exposes updates only to the internal host and blocks navigation while applying',async()=>{
    const actions:string[]=[];
    const ready:InternalUpdateState={enabled:true,phase:'ready',current,available:candidate,downloaded:candidate};
    const internalUpdates:InternalUpdateHost={request:async action=>{actions.push(action);return action==='apply'?{...ready,phase:'applying'}:ready}};
    const state=createState(),host={read:async()=>JSON.stringify(state),write:async()=>{},internalUpdates};
    const ui=renderUI(createElement(BlessingApp,{host,internalToolsEnabled:true,initialRoute:{page:'me'}}));await settle();await settle();
    await press(ui.host.querySelector('[data-update-action="apply"]')!);
    expect(actions.filter(a=>a==='apply')).toHaveLength(1);expect(ui.host.querySelector('.internal-update-mask')).not.toBeNull();
    await press(ui.host.querySelector('[data-tab="today"]')!);expect(ui.host.querySelector('.app-shell')?.getAttribute('data-page')).toBe('me');ui.unmount();
    const publicUI=renderUI(createElement(BlessingApp,{host,internalToolsEnabled:false,initialRoute:{page:'me'}}));await settle();await settle();
    expect(publicUI.host.querySelector('.internal-updates-panel')).toBeNull();publicUI.unmount();
  });
});
