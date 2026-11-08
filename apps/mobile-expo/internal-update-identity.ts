import * as Updates from 'expo-updates';
import type {InternalUpdateIdentity} from '@wbr/runtime';

const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
export function internalUpdateMetadata(manifest:unknown) {
  const extra=object(manifest)&&object(manifest.extra)?manifest.extra:undefined;
  const info=extra&&object(extra.internalUpdates)?extra.internalUpdates:undefined;
  const digest=(v:unknown)=>typeof v==='string'&&/^[a-f\d]{40}$/.test(v)?v:undefined;
  return {sourceCommit:digest(info?.sourceCommit),sourceTree:digest(info?.sourceTree),message:typeof info?.message==='string'?info.message.slice(0,1000):''};
}
// Kept separate from invitation storage: feedback can read the launch identity
// without importing the update controller that reads feedback settings.
export function internalUpdateIdentity():InternalUpdateIdentity {
  const info=internalUpdateMetadata(Updates.manifest);
  return {id:Updates.updateId,runtimeVersion:Updates.runtimeVersion,embedded:Updates.isEmbeddedLaunch,sourceCommit:info.sourceCommit,sourceTree:info.sourceTree};
}
