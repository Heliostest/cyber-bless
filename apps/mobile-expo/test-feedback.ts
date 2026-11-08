import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { TEST_FEEDBACK_KEY, sendTestFeedback, readTestFeedbackStatus, type TestFeedbackInfo } from '@wbr/runtime';
import {internalUpdateIdentity} from './internal-update-identity';

export const readTestFeedback = () => AsyncStorage.getItem(TEST_FEEDBACK_KEY);
let writes = Promise.resolve();
export function writeTestFeedback(raw: string): Promise<void> {
  const next = writes.catch(() => {}).then(() => AsyncStorage.setItem(TEST_FEEDBACK_KEY, raw));
  writes = next;
  return next;
}
export const flushTestFeedbackWrites=()=>writes;
export const submitTestFeedback = sendTestFeedback;
export const fetchTestFeedbackStatus = readTestFeedbackStatus;

export async function testFeedbackInfo(): Promise<TestFeedbackInfo> {
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const update=internalUpdateIdentity();
  const fallback = { platform, appVersion: 'unknown', buildNumber: 'unknown', osVersion: String(Platform.Version),
    ...(update.id?{updateId:update.id}:{}),...(update.runtimeVersion?{updateRuntimeVersion:update.runtimeVersion}:{}),
    ...(update.sourceCommit?{updateSourceCommit:update.sourceCommit}:{}),...(update.sourceTree?{updateSourceTree:update.sourceTree}:{}),updateEmbedded:update.embedded } as const;
  try {
    const runtime = requireOptionalNativeModule<{ getAppInfoAsync?(): Promise<{ appVersion: string; buildNumber: string }> }>('BlessingRuntime');
    const info = await runtime?.getAppInfoAsync?.();
    if (info && typeof info.appVersion === 'string' && typeof info.buildNumber === 'string')
      return { ...fallback, appVersion: info.appVersion, buildNumber: info.buildNumber };
  } catch { /* Old binaries may lack version metadata; never invent a build number. */ }
  return fallback;
}
