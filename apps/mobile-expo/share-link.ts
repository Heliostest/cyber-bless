import { Platform, Share } from 'react-native';
import { isPublicShareBaseUrl, parseSceneShareUrl } from '@wbr/core/scene-share';
import type { ShareLinkRequest } from '@wbr/runtime';

/** Native sharing accepts only the same public scene contract as the standalone page. */
export async function shareLink(request: ShareLinkRequest): Promise<void> {
  if (!request || typeof request.title !== 'string' || !request.title.trim() || request.title.length > 200 ||
      typeof request.text !== 'string' || request.text.length > 2000 ||
      !isPublicShareBaseUrl(request.url) || !parseSceneShareUrl(request.url)) {
    throw Error('Invalid public scene share link');
  }
  await Share.share(Platform.OS === 'ios'
    ? { title: request.title, message: request.text, url: request.url }
    : { title: request.title, message: `${request.text}\n${request.url}` },
  { dialogTitle: request.title });
  // Android reports sharedAction even when dismissed; no delivery claim is made here.
}
