import { getLocale, translate as tr } from '@wbr/i18n';
import { APP_STORE_URL, buildSceneShareUrl, isPublicShareBaseUrl } from '@wbr/core/scene-share';
import { getSceneVisualPreference } from '@wbr/core/visual-style';
import { captureSceneImage } from '@wbr/scene-runtime';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
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
  const { active, state, shareImage, shareLink, publicShareBaseUrl, uiSound } = useApp();
  const trigger = useRef<HTMLButtonElement>(null), dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId(), noteId = useId();
  const [open, setOpen] = useState(false);
  const openNow = useRef(false), latest = useRef({ active, uiSound, soundEnabled: state?.settings.sound !== false });
  latest.current = { active, uiSound, soundEnabled: state?.settings.sound !== false };
  const [image, setImage] = useState<PreparedShareImage>();
  const [preparing, setPreparing] = useState(false), [sharing, setSharing] = useState(false);
  const [status, setStatus] = useState('');
  const [linkStatus, setLinkStatus] = useState(''), [manualCopy, setManualCopy] = useState(false);
  const details = { sceneId, locale: getLocale(), visual: state ? getSceneVisualPreference(state, sceneId) : undefined };
  const shareUrl = publicShareBaseUrl && isPublicShareBaseUrl(publicShareBaseUrl) ? buildSceneShareUrl(publicShareBaseUrl, details) : undefined;
  const previewUrl = shareUrl ?? (!shareImage && ['http:', 'https:'].includes(window.location.protocol)
    ? buildSceneShareUrl(new URL('.', window.location.href).href, details) : undefined);
  const generation = useRef(0), audioGeneration = useRef(0), sharingNow = useRef(false);
  const close = useCallback(() => {
    if (!openNow.current) return;
    openNow.current = false;
    latest.current.uiSound?.('close');
    generation.current++;
    sharingNow.current = false;
    setOpen(false); setImage(undefined); setPreparing(false); setSharing(false); setStatus(''); setLinkStatus(''); setManualCopy(false);
    trigger.current?.focus();
  }, []);
  const currentRequest = (request: number) => openNow.current && generation.current === request;
  useEffect(() => () => { openNow.current = false; generation.current++; }, []);
  useEffect(() => {
    if (active && state?.settings.sound !== false) return;
    // UI work may finish normally, but its audio cannot cross a quiet lifecycle boundary.
    audioGeneration.current++;
  }, [active, state?.settings.sound]);
  useEffect(() => {
    const blur = () => { audioGeneration.current++; };
    const visibility = () => { if (document.hidden) blur(); };
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
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
  }, [open, close]);

  async function generate() {
    if (!active) return;
    uiSound?.(openNow.current ? 'select' : 'open');
    openNow.current = true;
    const request = ++generation.current;
    setOpen(true); setPreparing(true); setStatus(''); setImage(undefined);
    try {
      const root = trigger.current?.closest('.scene-experience');
      const frame = snapshot ?? (root ? captureSceneImage(root) : undefined);
      if (!frame) throw new Error('Scene frame unavailable');
      const prepared = await createRitualShareCard({ snapshot: frame, sceneId, title, brand: tr('一日一念'), completed: tr('已完成') });
      if (currentRequest(request)) setImage(prepared);
    } catch {
      if (currentRequest(request)) setStatus(tr('画面暂时无法生成，请重试。'));
    } finally {
      if (currentRequest(request)) setPreparing(false);
    }
  }

  async function share() {
    if (!openNow.current || !image || sharingNow.current || !active) return;
    uiSound?.('select');
    const request = generation.current;
    sharingNow.current = true; setSharing(true); setStatus('');
    try {
      if (shareImage) {
        await shareImage({ dataUrl: image.dataUrl, fileName: image.fileName, title: image.title });
      } else {
        const result = await shareImageInBrowser(image);
        if (result === 'unsupported' && currentRequest(request))
          setStatus(tr('当前设备不支持直接分享图片，请保存后发送。'));
      }
    } catch (error) {
      const cancelled = typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
      if (!cancelled && currentRequest(request))
        setStatus(shareImage ? tr('这一步暂时没有完成，请再试一次') : tr('暂时无法分享，请保存图片后发送。'));
    } finally {
      if (currentRequest(request)) { sharingNow.current = false; setSharing(false); }
    }
  }

  function showCopyResult(result: 'copied' | 'manual', audioRequest: number) {
    setManualCopy(result === 'manual');
    setLinkStatus(result === 'copied' ? tr('链接已复制') : tr('请长按复制下面的链接。'));
    if (result === 'copied' && audioGeneration.current === audioRequest && latest.current.active && latest.current.soundEnabled && !document.hidden)
      latest.current.uiSound?.('saved');
  }
  async function copyLink() {
    if (!openNow.current || !shareUrl || sharingNow.current || !active) return;
    const request = generation.current;
    const audioRequest = audioGeneration.current;
    sharingNow.current = true; setSharing(true);
    try {
      const result = await copySceneLink(shareUrl);
      if (currentRequest(request)) showCopyResult(result, audioRequest);
    } finally {
      if (currentRequest(request)) { sharingNow.current = false; setSharing(false); }
    }
  }
  async function shareScene() {
    if (!openNow.current || !shareUrl || sharingNow.current || !active) return;
    // The browser fallback may copy the link instead; that path gets only its result cue.
    if (shareLink || typeof navigator.share === 'function') uiSound?.('select');
    const request = generation.current;
    const audioRequest = audioGeneration.current;
    sharingNow.current = true; setSharing(true); setLinkStatus('');
    const payload = { title, text: `${tr('打开这个互动场景，一起体验这一刻。')}\n${tr('在 App Store 查看')}：${APP_STORE_URL}`, url: shareUrl };
    try {
      if (shareLink) await shareLink(payload);
      else {
        const result = await shareSceneLinkInBrowser(payload);
        if (currentRequest(request) && (result === 'copied' || result === 'manual')) showCopyResult(result, audioRequest);
      }
    } catch (error) {
      const cancelled = typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
      if (!cancelled && currentRequest(request)) setLinkStatus(tr('这一步暂时没有完成，请再试一次'));
    } finally {
      if (currentRequest(request)) { sharingNow.current = false; setSharing(false); }
    }
  }

  return <>
    <button data-audio-cue={open ? undefined : "open"} type="button" ref={trigger} className={`button outline scene-share-trigger ${className}`} disabled={!active} onClick={() => { if (!openNow.current) void generate(); }}>
      <Icon name="share"/>{tr('分享仪式')}
    </button>
    {open && <dialog ref={dialog} className="ritual-share-dialog" aria-labelledby={headingId} aria-describedby={noteId}
      onCancel={event => { event.preventDefault(); close(); }} onClose={close}>
      <div className="ritual-share-heading">
        <h2 id={headingId}>{tr('分享这场仪式')}</h2>
        <button data-audio-cue="close" type="button" className="text-button" aria-label={tr('关闭分享')} onClick={close} autoFocus><Icon name="close"/></button>
      </div>
      <div className="ritual-share-link">
        {shareUrl ? <div className="ritual-share-actions">
          <button data-audio-cue={shareLink || typeof navigator.share === "function" ? "select" : "saved"} type="button" className="button primary" disabled={sharing || !active} onClick={() => void shareScene()}><Icon name="share"/>{tr('分享互动场景')}</button>
          <button data-audio-cue="saved" type="button" className="button secondary" disabled={sharing || !active} onClick={() => void copyLink()}>{tr('复制链接')}</button>
        </div> : <p className="ritual-share-note">{tr('互动链接分享暂未开放。')}</p>}
        <div className="ritual-share-destinations">
          {previewUrl && <a data-audio-cue="select" href={previewUrl} target="_blank" rel="noopener noreferrer" onClick={() => uiSound?.('select')}>{tr('预览互动场景')}</a>}
          <a data-audio-cue="select" href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" onClick={() => uiSound?.('select')}>{tr('在 App Store 查看')}</a>
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
          <button data-audio-cue="select" type="button" className={`button ${shareUrl ? 'secondary' : 'primary'}`} disabled={sharing || !active} onClick={() => void share()}><Icon name="share"/>{tr('分享图片')}</button>
          {!shareImage && <a data-audio-cue="select" className="button secondary" href={image.dataUrl} download={image.fileName} onClick={() => uiSound?.('select')}>{tr('保存图片')}</a>}
        </> : <button data-audio-cue="select" type="button" className="button secondary" disabled={preparing || sharing || !active} onClick={() => void generate()}>{tr('重新生成')}</button>}
      </div>
    </dialog>}
  </>;
}
