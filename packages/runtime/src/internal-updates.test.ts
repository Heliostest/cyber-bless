import {describe,it,expect,vi} from 'vitest'
import {createInternalUpdateController,type InternalUpdateCandidate} from './internal-updates'

const current={id:null,runtimeVersion:'native-v1',embedded:true}
const candidate:InternalUpdateCandidate={id:'4ca724b7-a28e-4355-81ac-bb4ed70838e5',runtimeVersion:'native-v1',message:'Cloth smoothing',sourceCommit:'a'.repeat(40),kind:'update'}
function mount(extra:Record<string,unknown>={}) {
  const adapter={enabled:()=>true,current:()=>current,readInvitation:async()=> 'test-invitation',authorize:vi.fn(),check:vi.fn(async()=>candidate),download:vi.fn(async()=>candidate),flushWrites:vi.fn(async()=>{}),canApply:()=>true,reload:vi.fn(async()=>{}),...extra}
  return {adapter,controller:createInternalUpdateController(adapter)}
}
describe('internal update controller',()=>{
  it('checks and downloads independently and never applies from either action',async()=>{
    const s=mount();expect((await s.controller.request('status')).phase).toBe('idle')
    const available=await s.controller.request('check');expect(available.available?.id).toBe(candidate.id);expect(available.downloaded).toBeUndefined()
    expect(s.adapter.reload).not.toHaveBeenCalled()
    const ready=await s.controller.request('download');expect(ready.phase).toBe('ready');expect(ready.downloaded?.id).toBe(candidate.id)
    expect(s.adapter.reload).not.toHaveBeenCalled();await s.controller.request('apply');expect(s.adapter.reload).toHaveBeenCalledOnce()
  })
  it('fails closed when disabled or without an invitation',async()=>{
    const disabled=mount({enabled:()=>false});expect((await disabled.controller.request('check')).phase).toBe('unavailable');expect(disabled.adapter.check).not.toHaveBeenCalled()
    const missing=mount({readInvitation:async()=>''});expect((await missing.controller.request('check')).error).toBe('invitation');expect(missing.adapter.authorize).not.toHaveBeenCalled()
  })
  it('refuses incompatible signed content and requires a successful download before apply',async()=>{
    const s=mount({check:async()=>({...candidate,runtimeVersion:'other-native'})});expect((await s.controller.request('check')).error).toBe('incompatible')
    expect((await s.controller.request('apply')).error).toBe('not-downloaded');expect(s.adapter.reload).not.toHaveBeenCalled()
  })
  it('waits for durable saves and rechecks the active safety guard before reload',async()=>{
    let release!:()=>void,allowed=true
    const s=mount({flushWrites:()=>new Promise<void>(resolve=>{release=resolve}),canApply:()=>allowed})
    await s.controller.request('download');const applying=s.controller.request('apply');await Promise.resolve()
    expect(s.adapter.reload).not.toHaveBeenCalled();allowed=false;release();expect((await applying).error).toBe('unsafe');expect(s.adapter.reload).not.toHaveBeenCalled()
  })
  it('preserves a downloaded version when saving fails and allows an explicit retry',async()=>{
    const s=mount();await s.controller.request('download');s.adapter.flushWrites.mockRejectedValueOnce(Error('disk unavailable'))
    const failed=await s.controller.request('apply');expect(failed.error).toBe('save');expect(failed.downloaded?.id).toBe(candidate.id);expect(s.adapter.reload).not.toHaveBeenCalled()
    await s.controller.request('apply');expect(s.adapter.reload).toHaveBeenCalledOnce()
  })
  it('owns a single operation while allowing status reads and reports bounded download progress',async()=>{
    let done!:(value:InternalUpdateCandidate)=>void
    const s=mount({download:vi.fn(()=>new Promise<InternalUpdateCandidate>(resolve=>{done=resolve}))})
    const downloading=s.controller.request('download');await Promise.resolve();await Promise.resolve()
    s.controller.updateProgress(.4);expect((await s.controller.request('status')).progress).toBe(.4)
    s.controller.updateProgress(NaN);expect((await s.controller.request('status')).progress).toBe(.4)
    expect((await s.controller.request('apply')).phase).toBe('downloading');expect(s.adapter.reload).not.toHaveBeenCalled()
    done(candidate);await downloading;expect(s.adapter.download).toHaveBeenCalledOnce()
  })
  it('does not apply a superseded downloaded candidate after checking a newer release',async()=>{
    const s=mount();await s.controller.request('download');s.adapter.check.mockResolvedValueOnce({...candidate,id:'07b3dc2a-6623-4552-953d-779f4fa752f5'})
    await s.controller.request('check');expect((await s.controller.request('apply')).error).toBe('not-downloaded');expect(s.adapter.reload).not.toHaveBeenCalled()
  })
  it('keeps failed network and reload details out of the public state and supports embedded rollback',async()=>{
    const s=mount();s.adapter.check.mockRejectedValueOnce(Error('private token must not leak'))
    const error=await s.controller.request('check');expect(error.error).toBe('network');expect(JSON.stringify(error)).not.toContain('private token')
    const rollback:InternalUpdateCandidate={id:'embedded',runtimeVersion:'native-v1',message:'',kind:'embedded'}
    s.adapter.download.mockResolvedValueOnce(rollback);expect((await s.controller.request('download')).downloaded?.kind).toBe('embedded')
    s.adapter.reload.mockRejectedValueOnce(Error('native failure'));expect((await s.controller.request('apply')).error).toBe('reload')
  })
})
