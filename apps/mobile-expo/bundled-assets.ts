import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { validateNativeAssetUri } from '@wbr/scene-runtime/asset-urls';
import { bundledAssetModules } from './bundled-assets.generated';

let resolved: Promise<Record<string, string>> | undefined;

/** Resolve this launch's Metro modules, including assets installed by Updates. */
export function resolveBundledAssetUris(): Promise<Record<string, string>> {
  return resolved ??= (async () => {
    const entries = await Promise.all(Object.entries(bundledAssetModules).map(async ([file, entry]) => {
      if (!Number.isInteger(entry.module) || entry.module <= 0) throw Error(`Unregistered bundled asset: ${file}`);
      const registered = Asset.fromModule(entry.module);
      // Use a fresh content-addressed instance. Hashless fromURI caches an
      // Android resource name across APK upgrades; reused downloaded instances
      // also skip the native cache integrity/repair path. The constructor still
      // resolves this MD5 through Expo Updates' installed localAssets map.
      const asset = await new Asset({
        name: registered.name, type: registered.type, uri: registered.uri, hash: entry.md5,
      }).downloadAsync();
      validateNativeAssetUri(asset.localUri);
      const local = new File(asset.localUri);
      if (!local.exists || local.size !== entry.bytes || local.md5 !== entry.md5)
        throw Error(`Bundled asset unavailable or changed: ${file}`);
      return [file, asset.localUri] as const;
    }));
    return Object.freeze(Object.fromEntries(entries));
  })().catch(error => { resolved = undefined; throw error; });
}
