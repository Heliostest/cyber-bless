import { bundledAssetPaths } from './asset-paths.generated';

declare const process: { env: { EXPO_BASE_URL?: string } };
const registeredPaths = new Set<string>(bundledAssetPaths);
let nativeAssets: Readonly<Record<string, string>> | undefined;

/** Accept only unambiguous local files returned for registered Metro assets. */
export function validateNativeAssetUri(uri: unknown): asserts uri is string {
  if (typeof uri !== 'string' || !/^file:\/\/\/[^?#\\\s'"<>]+$/.test(uri)) throw Error('Unsafe native asset URI');
  let decoded: string;
  try { decoded = decodeURIComponent(uri.slice('file:///'.length)); }
  catch { throw Error('Unsafe native asset URI'); }
  if (/[\\\x00-\x1f\x7f]/.test(decoded) || decoded.split('/').some(part => part === '.' || part === '..') || /%2f|%5c/i.test(uri))
    throw Error('Unsafe native asset URI');
}

/** Install before mounting the DOM app. An empty map preserves browser/public use. */
export function installNativeAssetMap(map: Record<string, string>) {
  if (!map || typeof map !== 'object' || Array.isArray(map)) throw Error('Invalid native asset map');
  const next: Record<string, string> = {};
  for (const [file, uri] of Object.entries(map)) {
    if (!registeredPaths.has(file)) throw Error(`Unknown native asset: ${file}`);
    validateNativeAssetUri(uri);
    next[file] = uri;
  }
  nativeAssets = Object.keys(next).length ? Object.freeze(next) : undefined;
}

/** Shared by DOM model, environment, font, image and audio loaders. */
export function assetUrl(file: string): string {
  const normalized = file.startsWith('/') ? file.slice(1) : file;
  if (file && !registeredPaths.has(normalized)) throw Error(`Unknown bundled asset: ${file}`);
  if (nativeAssets && normalized) {
    const uri = nativeAssets[normalized];
    if (!uri) throw Error(`Native asset missing: ${normalized}`);
    return uri;
  }
  const base = process.env.EXPO_BASE_URL || '/';
  return `${base.replace(/\/$/, '')}/${normalized}`;
}
