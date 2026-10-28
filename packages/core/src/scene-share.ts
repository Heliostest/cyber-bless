import { isSupportedLocale, type SupportedLocale } from '@wbr/i18n/locales';
import { builtInScenes, isSceneVisibleInApp } from './daily-scenes.ts';
import { isVisualStyle, normalizeStyleParameters, styleParameterControls, type VisualStylePreference } from './visual-style.ts';

/** App Store Connect ID from apps/mobile-expo/eas.json; does not imply a released listing. */
export const APP_STORE_URL = 'https://apps.apple.com/app/id6821271597';
export type SceneShareDetails = { sceneId: string; locale: SupportedLocale; visual?: VisualStylePreference };

const MAX_URL_LENGTH = 4096;
const MAX_PARAMETER_LENGTH = 2048;
const sceneIds = new Set(builtInScenes.filter(isSceneVisibleInApp).map(entry => entry.id));
const parameterKeys = new Set<string>(styleParameterControls.map(control => control.key));
const queryKeys = new Set(['v', 'scene', 'lang', 'style', 'params']);

function readUrl(raw: string): URL | undefined {
  if (typeof raw !== 'string' || !raw || raw.length > MAX_URL_LENGTH || /[\s\\\u0000-\u001f\u007f]/.test(raw)) return;
  try {
    const url = new URL(raw);
    if (url.username || url.password) return;
    return url;
  } catch { return; }
}

function publicHost(host: string): boolean {
  host = host.toLowerCase().replace(/\.$/, '');
  if (host.startsWith('[')) {
    // Only global unicast IPv6; exclude documentation and all mapped/local forms.
    return /^[23][0-9a-f]{0,3}:/.test(host.slice(1, -1)) && !host.startsWith('[2001:db8:');
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const [a, b, c] = host.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113));
  }
  const labels = host.split('.');
  if (labels.length < 2 || labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return false;
  if (['local', 'localhost', 'localdomain', 'test', 'invalid', 'example', 'internal', 'lan', 'home', 'corp', 'arpa', 'alt', 'onion'].includes(labels.at(-1)!)) return false;
  return !labels.some(label => ['localhost', 'example', 'your-domain', 'yourdomain', 'placeholder'].includes(label));
}

function isPublicUrl(url: URL): boolean {
  return url.protocol === 'https:' && publicHost(url.hostname);
}

function isLocalPreview(url: URL): boolean {
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  return url.protocol === 'http:' && (host === 'localhost' || host.endsWith('.localhost') ||
    host === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(host));
}

/** Syntactic public-host check; callers configure the deployed site, never a preview address. */
export function isPublicShareBaseUrl(raw: string): boolean {
  const url = readUrl(raw);
  return !!url && isPublicUrl(url);
}

function visualPreference(style: unknown, parameters: unknown): VisualStylePreference | undefined {
  if (!isVisualStyle(style)) return;
  if (parameters !== undefined && (!parameters || typeof parameters !== 'object' || Array.isArray(parameters))) return;
  if (parameters && Object.entries(parameters).some(([key, value]) =>
    !parameterKeys.has(key) || typeof value !== 'number' || !Number.isFinite(value))) return;
  return { style, parameters: normalizeStyleParameters(parameters) };
}

function readParameters(raw: string): Record<string, number> | undefined {
  if (raw.length > MAX_PARAMETER_LENGTH) return;
  try {
    const parameters: unknown = JSON.parse(raw);
    if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters) ||
        Object.entries(parameters).some(([key, value]) => !parameterKeys.has(key) || typeof value !== 'number' || !Number.isFinite(value))) return;
    // Numeric controls form a flat object, so repeated decoded keys must not be silently overwritten by JSON.parse.
    const keys = [...raw.matchAll(/"(?:\\.|[^"\\])*"\s*:/g)].map(match => JSON.parse(match[0].slice(0, -1).trim()) as string);
    if (keys.length !== new Set(keys).size) return;
    return parameters as Record<string, number>;
  } catch { return; }
}

/** Only bundled visible scene IDs, language, shader and bounded numeric controls cross this boundary. */
export function buildSceneShareUrl(baseUrl: string, details: SceneShareDetails): string | undefined {
  const url = readUrl(baseUrl);
  if (!url || (!isPublicUrl(url) && !isLocalPreview(url)) || !details ||
      !sceneIds.has(details.sceneId) || !isSupportedLocale(details.locale)) return;
  const visual = details.visual === undefined ? undefined : visualPreference(details.visual?.style, details.visual?.parameters);
  if (details.visual !== undefined && !visual) return;
  const directory = url.pathname.endsWith('/share.html') ? url.pathname.slice(0, -10) : url.pathname.replace(/\/?$/, '/');
  url.pathname = `${directory}share.html`;
  url.search = '';
  url.hash = '';
  url.searchParams.set('v', '1');
  url.searchParams.set('scene', details.sceneId);
  url.searchParams.set('lang', details.locale);
  if (visual) {
    url.searchParams.set('style', visual.style);
    url.searchParams.set('params', JSON.stringify(visual.parameters));
  }
  return url.href.length <= MAX_URL_LENGTH ? url.href : undefined;
}

export function parseSceneShareUrl(raw: string): SceneShareDetails | undefined {
  const url = readUrl(raw);
  if (!url || (!isPublicUrl(url) && !isLocalPreview(url)) || !url.pathname.endsWith('/share.html') || raw.includes('#')) return;
  const keys = [...url.searchParams.keys()];
  if (keys.some(key => !queryKeys.has(key)) || new Set(keys).size !== keys.length || url.searchParams.get('v') !== '1') return;
  const sceneId = url.searchParams.get('scene'), locale = url.searchParams.get('lang');
  if (!sceneId || !sceneIds.has(sceneId) || !isSupportedLocale(locale)) return;
  const style = url.searchParams.get('style'), rawParameters = url.searchParams.get('params');
  if (style === null) return rawParameters === null ? { sceneId, locale } : undefined;
  const parameters = rawParameters === null ? undefined : readParameters(rawParameters);
  if (rawParameters !== null && parameters === undefined) return;
  const visual = visualPreference(style, parameters);
  return visual ? { sceneId, locale, visual } : undefined;
}
