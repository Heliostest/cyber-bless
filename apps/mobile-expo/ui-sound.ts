import { File } from 'expo-file-system';
import { UI_SOUND_FILES } from '@wbr/app/ui-sound-assets';
import { resolveBundledAssetUris } from './bundled-assets';

const files = new Set<string>(Object.values(UI_SOUND_FILES));

/** Only the small approved sound files may cross this bridge, never arbitrary paths. */
export async function readUiSound(file: string): Promise<string> {
  if (!files.has(file)) throw Error('Unknown UI sound');
  const source = new File((await resolveBundledAssetUris())[file]);
  if (!source.exists || source.size <= 0 || source.size > 100000)
    throw Error('Bundled UI sound unavailable');
  return source.base64();
}
