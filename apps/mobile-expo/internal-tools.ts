import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

type RuntimeModule = { isTestFlightAsync(): Promise<boolean> };

/** A production build can be promoted from TestFlight to the App Store unchanged. */
export async function detectInternalToolsEnabled(): Promise<boolean> {
  if (__DEV__) return true;
  if (Platform.OS !== 'ios') return false;
  try {
    const runtime = requireOptionalNativeModule<RuntimeModule>('BlessingRuntime');
    return await runtime?.isTestFlightAsync() === true;
  } catch {
    // Older binaries, an unavailable store transaction or failed verification fail closed.
    return false;
  }
}
