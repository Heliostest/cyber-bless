import { getLocale, translate as tr } from '@wbr/i18n';
import { APP_STORE_URL, buildSceneShareUrl, isPublicShareBaseUrl } from '@wbr/core/scene-share';
import { getSceneVisualPreference } from '@wbr/core/visual-style';
import { captureSceneImage } from '@wbr/scene-runtime';
import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './art';
import { useApp } from './context';
import { createRitualShareCard, shareImageInBrowser, type PreparedShareImage } from './ritual-share-image';
import { copySceneLink, shareSceneLinkInBrowser } from './ritual-share-link';

const dismissEvent = 'wbr:close-ritual-share';
/** Native Back closes the preview before leaving the completed ritual. */
export function dismissRitualShare(scope?: HTMLElement | null): boolean {
  return !document.dispatchEvent(new CustomEvent(dismissEvent, { cancelable: true, detail: scope }));
}

export function SceneShareButton(props: { sceneId: string; title: string; snapshot?: string; className?: string }) {
  return <ShareButton key={props.sceneId} {...props}/>;
}

function ShareButton({ sceneId, title, snapshot, className = '' }: {
  sceneId: string; title: string; snapshot?: string; className?: string;
}) {
  const { active, state, shareImage, shareLink, publicShareBaseUrl } = useApp();
  const trigger = useRef<HTMLButtonElement>(null), dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId(), noteId = useId();
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState<PreparedShareImage>();
  const [preparing, setPreparing] = useState(false), [sharing, setSharing] = useState(false);
  const [status, setStatus] = useState('');
  const [linkStatus, setLinkStatus] = useState(''), [manualCopy, setManualCopy] = useState(false);
  const details = { sceneId, locale: getLocale(), visual: state ? getSceneVisualPreference(state, sceneId) : undefined };
  const shareUrl = publicShareBaseUrl && isPublicShareBaseUrl(publicShareBaseUrl) ? buildSceneShareUrl(publicShareBaseUrl, details) : undefined;
  const previewUrl = shareUrl ?? (!shareImage && ['http:', 'https:'].includes(window.location.protocol)
    ? buildSceneShareUrl(new URL('.', window.location.href).href, details) : undefined);
  const generation = useRef(0), sharingNow = useRef(false);
  const close = () => {
    generation.current++;
    setOpen(false); setImage(undefined); setPreparing(false); setStatus(''); setLinkStatus(''); setManualCopy(false);
    trigger.current?.focus();
  };
  useEffect(() => () => { generation.current++; }, []);
  useEffect(() => {
    if (!open) return;
    dialog.current?.showModal();
    const dismiss = (event: Event) => {
      const scope = (event as CustomEvent<HTMLElement | undefined>).detail;
      if (scope && !scope.contains(dialog.current)) return;
      event.preventDefault(); close();
    };
    document.addEventListener(dismissEvent, dismiss);
    return () => document.removeEventListener(dismissEvent, dismiss);
  }, [open]);

  async function generate() {
    const request = ++generation.current;
    setOpen(true); setPreparing(true); setStatus(''); setImage(undefined);
    try {
      const root = trigger.current?.closest('.scene-experience');
      const frame = snapshot ?? (root ? captureSceneImage(root) : undefined);
      if (!frame) throw new Error('Scene frame unavailable');
      const prepared = await createRitualShareCard({ snapshot: frame, sceneId, title, brand: tr('一日一念'), completed: tr('已完成') });
      if (generation.current === request) setImage(prepared);
    } catch {
      if (generation.current === request) setStatus(tr('画面暂时无法生成，请重试。'));
    } finally {
      if (generation.current === request) setPreparing(false);
    }
  }

  async function share() {
    if (!image || sharingNow.current || !active) return;
    const request = generation.current;
    sharingNow.current = true; setSharing(true); setStatus('');
    try {
      if (shareImage) {
        await shareImage({ dataUrl: image.dataUrl, fileName: image.fileName, title: image.title });
      } else {
        const result = await shareImageInBrowser(image);
        if (result === 'unsupported' && generation.current === request)
          setStatus(tr('当前设备不支持直接分享图片，请保存后发送。'));
      }
    } catch (error) {
      const cancelled = typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
      if (!cancelled && generation.current === request)
        setStatus(shareImage ? tr('这一步暂时没有完成，请再试一次') : tr('暂时无法分享，请保存图片后发送。'));
    } finally {
      sharingNow.current = false;
      if (generation.current === request) setSharing(false);
    }
  }

  function showCopyResult(result: 'copied' | 'manual') {
    setManualCopy(result === 'manual');
    setLinkStatus(result === 'copied' ? tr('链接已复制') : tr('请长按复制下面的链接。'));
  }
  async function shareScene() {
    if (!shareUrl || sharingNow.current || !active) return;
    const request = generation.current;
    sharingNow.current = true; setSharing(true); setLinkStatus('');
    const payload = { title, text: `${tr('打开这个互动场景，一起体验这一刻。')}\n${tr('在 App Store 查看')}：${APP_STORE_URL}`, url: shareUrl };
    try {
      if (shareLink) await shareLink(payload);
      else {
        const result = await shareSceneLinkInBrowser(payload);
        if (generation.current === request && (result === 'copied' || result === 'manual')) showCopyResult(result);
      }
    } catch (error) {
      const cancelled = typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
      if (!cancelled && generation.current === request) setLinkStatus(tr('这一步暂时没有完成，请再试一次'));
    } finally {
      sharingNow.current = false;
      if (generation.current === request) setSharing(false);
    }
  }

  return <>
    <button type="button" ref={trigger} className={`button outline scene-share-trigger ${className}`} disabled={!active} onClick={() => { setSharing(false); void generate(); }}>
      <Icon name="share"/>{tr('分享仪式')}
    </button>
    {open && <dialog ref={dialog} className="ritual-share-dialog" aria-labelledby={headingId} aria-describedby={noteId}
      onCancel={event => { event.preventDefault(); close(); }} onClose={close}>
      <div className="ritual-share-heading">
        <h2 id={headingId}>{tr('分享这场仪式')}</h2>
        <button type="button" className="text-button" aria-label={tr('关闭分享')} onClick={close} autoFocus><Icon name="close"/></button>
      </div>
      <div className="ritual-share-link">
        {shareUrl ? <div className="ritual-share-actions">
          <button type="button" className="button primary" disabled={sharing || !active} onClick={() => void shareScene()}><Icon name="share"/>{tr('分享互动场景')}</button>
          <button type="button" className="button secondary" disabled={sharing || !active} onClick={async () => { const request = generation.current; const result = await copySceneLink(shareUrl); if (generation.current === request) showCopyResult(result); }}>{tr('复制链接')}</button>
        </div> : <p className="ritual-share-note">{tr('互动链接分享暂未开放。')}</p>}
        <div className="ritual-share-destinations">
          {previewUrl && <a href={previewUrl} target="_blank" rel="noopener noreferrer">{tr('预览互动场景')}</a>}
          <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">{tr('在 App Store 查看')}</a>
        </div>
        <p className="ritual-share-status" role="status">{linkStatus}</p>
        {manualCopy && shareUrl && <input className="ritual-share-url" aria-label={tr('分享链接')} value={shareUrl} readOnly onFocus={event => event.currentTarget.select()}/>}
      </div>
      <h3 className="ritual-share-image-title">{tr('预览分享图片')}</h3>
      <div className="ritual-share-picture" aria-busy={preparing}>
        {image ? <img src={image.dataUrl} alt={title} width={1080} height={1350}/> : preparing ? <p role="status">{tr('正在准备图片…')}</p> : null}
      </div>
      <p id={noteId} className="ritual-share-note">{tr('分享前请确认画面中没有不想公开的内容。')}</p>
      <p className="ritual-share-status" role="status">{status}</p>
      <div className="ritual-share-actions">
        {image ? <>
          <button type="button" className={`button ${shareUrl ? 'secondary' : 'primary'}`} disabled={sharing || !active} onClick={() => void share()}><Icon name="share"/>{tr('分享图片')}</button>
          {!shareImage && <a className="button secondary" href={image.dataUrl} download={image.fileName}>{tr('保存图片')}</a>}
        </> : <button type="button" className="button secondary" disabled={preparing || sharing || !active} onClick={() => void generate()}>{tr('重新生成')}</button>}
      </div>
    </dialog>}
  </>;
}
