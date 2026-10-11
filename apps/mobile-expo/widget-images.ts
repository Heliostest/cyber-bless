import { Asset } from 'expo-asset';
import { Directory, File } from 'expo-file-system';
import { widgetPreviewAssets } from './widget-preview-assets';
import manifest from '../../assets/widgets/today/manifest.json';

export type WidgetCoverPaths = Record<string, { small: string; medium: string }>;
const pending = new Map<string, Promise<WidgetCoverPaths>>();
/** Images must exist in the App Group before any timeline can reference them. */
export function prepareWidgetImages(group: string): Promise<WidgetCoverPaths> {
  const previous = pending.get(group);
  if (previous) return previous;
  const result = (async () => {
    const directory = new Directory(group, `covers-${manifest.revision}`);
    directory.create({ intermediates: true, idempotent: true });
    const paths: WidgetCoverPaths = {};
    for (const [id, sizes] of Object.entries(widgetPreviewAssets)) {
      paths[id] = { small: '', medium: '' };
      for (const size of ['small', 'medium'] as const) {
        const destination = new File(directory, `${id}-${size}.png`);
        if (!destination.exists || !destination.size) {
          const asset = await Asset.fromModule(sizes[size]).downloadAsync();
          if (!asset.localUri) throw Error('Bundled widget cover unavailable');
          const temporary = new File(directory, `${id}-${size}.tmp`);
          try {
            if (temporary.exists) temporary.delete();
            await new File(asset.localUri).copy(temporary);
            if (!temporary.size) throw Error('Empty widget cover');
            await temporary.move(destination, { overwrite: true });
          } catch (error) {
            try { if (temporary.exists) temporary.delete(); } catch { /* Next refresh retries. */ }
            throw error;
          }
        }
        paths[id][size] = destination.uri;
      }
    }
    return paths;
  })().catch(error => { pending.delete(group); throw error; });
  pending.set(group, result);
  return result;
}
