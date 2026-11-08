import * as Updates from 'expo-updates';
import {INTERNAL_TOOLS_ENABLED} from '@wbr/app/internal-tools-config';
import {createInternalUpdateController,type InternalUpdateCandidate} from '@wbr/runtime';
import {normalizeFeedbackEndpoint} from '@wbr/shared/test-feedback';
import {readTestFeedback} from './test-feedback';
import {internalUpdateIdentity,internalUpdateMetadata} from './internal-update-identity';

const origin='https://feedback.heliosoft.win';
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
function candidate(manifest:unknown):InternalUpdateCandidate {
  if(!object(manifest)||typeof manifest.id!=='string'||typeof manifest.runtimeVersion!=='string')throw Error('Invalid update manifest');
  return {id:manifest.id,runtimeVersion:manifest.runtimeVersion,kind:'update',...internalUpdateMetadata(manifest),createdAt:typeof manifest.createdAt==='string'?manifest.createdAt:undefined};
}
const embedded=():InternalUpdateCandidate=>({id:'embedded',runtimeVersion:Updates.runtimeVersion??'',kind:'embedded',message:''});
export function createNativeUpdateHost(options:{isActive():boolean;flushWrites():Promise<void>}) {
  return createInternalUpdateController({
    enabled:()=>INTERNAL_TOOLS_ENABLED&&Updates.isEnabled,
    current:internalUpdateIdentity,
    async readInvitation(){
      const raw=await readTestFeedback();if(raw===null)return '';
      const stored:unknown=JSON.parse(raw);
      if(!object(stored)||stored.version!==1||!object(stored.connection)||typeof stored.connection.token!=='string'||typeof stored.connection.endpoint!=='string')return '';
      if(new URL(normalizeFeedbackEndpoint(stored.connection.endpoint)).origin!==origin)return '';
      return stored.connection.token;
    },
    authorize(token){Updates.setUpdateRequestHeadersOverride({'expo-channel-name':'internal','X-Feedback-Token':token})},
    async check(){const result=await Updates.checkForUpdateAsync();return result.isRollBackToEmbedded?embedded():result.isAvailable?candidate(result.manifest):undefined},
    async download(){const result=await Updates.fetchUpdateAsync();return result.isRollBackToEmbedded?embedded():result.isNew?candidate(result.manifest):undefined},
    canApply:options.isActive,
    flushWrites:options.flushWrites,
    async reload(){await Updates.reloadAsync()},
  });
}
