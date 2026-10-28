import type { ShareLinkRequest } from '@wbr/runtime';

export async function copySceneLink(url: string): Promise<'copied' | 'manual'> {
  try {
    if (!navigator.clipboard?.writeText) return 'manual';
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch { return 'manual'; }
}

/** The URL is ready before this function runs, preserving the click's activation. */
export async function shareSceneLinkInBrowser(link: ShareLinkRequest): Promise<'shared' | 'cancelled' | 'copied' | 'manual'> {
  if (typeof navigator.share !== 'function') return copySceneLink(link.url);
  try {
    await navigator.share(link);
    return 'shared';
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError') return 'cancelled';
    throw error;
  }
}
