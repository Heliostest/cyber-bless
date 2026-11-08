import {beforeEach,describe,it,expect,vi} from 'vitest';
const native=vi.hoisted(()=>({isEnabled:true,updateId:null,runtimeVersion:'native-v1',isEmbeddedLaunch:true,manifest:{},setUpdateRequestHeadersOverride:vi.fn(),checkForUpdateAsync:vi.fn(),fetchUpdateAsync:vi.fn(),reloadAsync:vi.fn()}));
const storage=vi.hoisted(()=>({readTestFeedback:vi.fn()}));
vi.mock('expo-updates',()=>native);vi.mock('./test-feedback',()=>storage);
import {createNativeUpdateHost} from './internal-updates';
import {withInternalUpdates} from '../../scripts/internal-update-config.mjs';
import {internalUpdateIdentity,internalUpdateMetadata} from './internal-update-identity';
beforeEach(()=>{vi.clearAllMocks();storage.readTestFeedback.mockResolvedValue(JSON.stringify({version:1,connection:{endpoint:'https://feedback.heliosoft.win/api/feedback',token:'tester-invitation'}}));native.checkForUpdateAsync.mockResolvedValue({isAvailable:false,isRollBackToEmbedded:false});native.fetchUpdateAsync.mockResolvedValue({isNew:true,isRollBackToEmbedded:false,manifest:{id:'4ca724b7-a28e-4355-81ac-bb4ed70838e5',runtimeVersion:'native-v1',extra:{internalUpdates:{sourceCommit:'a'.repeat(40),message:'scene fix'}}}})});
describe('native update bridge',()=>{
  it('declares all overridden header keys in the embedded native allowlist without embedding the invitation',async()=>{
    const config=withInternalUpdates({name:'Test',slug:'test'},{internalToolsEnabled:true,requested:'1'});
    const headers=config.updates?.requestHeaders;
    if(!headers)throw Error('Missing embedded request header configuration');
    native.setUpdateRequestHeadersOverride.mockImplementationOnce((override:Record<string,string>)=>{
      // Installed SDK57 iOS/Android both reject keys absent from embedded
      // requestHeaders, even when the update URL itself is unchanged.
      for(const key of Object.keys(override))expect(Object.keys(headers)).toContain(key);
      expect(headers['X-Feedback-Token']).toBe('');
    });
    const host=createNativeUpdateHost({isActive:()=>true,flushWrites:async()=>{}});
    expect((await host.request('check')).error).toBeUndefined();expect(native.checkForUpdateAsync).toHaveBeenCalledOnce();
  });
  it('uses the saved invitation only for the pinned update service and does not reload on download',async()=>{
    const host=createNativeUpdateHost({isActive:()=>true,flushWrites:async()=>{}});await host.request('download');
    expect(native.setUpdateRequestHeadersOverride).toHaveBeenCalledWith({'expo-channel-name':'internal','X-Feedback-Token':'tester-invitation'});
    expect(native.reloadAsync).not.toHaveBeenCalled();await host.request('apply');expect(native.reloadAsync).toHaveBeenCalledOnce();
  });
  it('does not forward invitations for a different configured feedback receiver',async()=>{
    storage.readTestFeedback.mockResolvedValue(JSON.stringify({version:1,connection:{endpoint:'https://another.example/api/feedback',token:'secret'}}));
    const host=createNativeUpdateHost({isActive:()=>true,flushWrites:async()=>{}});expect((await host.request('check')).error).toBe('invitation');expect(native.setUpdateRequestHeadersOverride).not.toHaveBeenCalled();expect(native.checkForUpdateAsync).not.toHaveBeenCalled();
  });
  it('records native launch identity and bounds metadata without inventing provenance',()=>{
    expect(internalUpdateIdentity()).toEqual({id:null,runtimeVersion:'native-v1',embedded:true,sourceCommit:undefined,sourceTree:undefined});
    expect(internalUpdateMetadata({extra:{internalUpdates:{sourceCommit:'not-a-commit',sourceTree:'c'.repeat(40),message:'x'.repeat(1200)}}})).toEqual({sourceCommit:undefined,sourceTree:'c'.repeat(40),message:'x'.repeat(1000)});
  });
});
