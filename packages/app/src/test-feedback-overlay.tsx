import { useEffect, useRef, useState } from 'react';
import { getFormatLocale, translate as tr } from '@wbr/i18n';
import type { CatalogEntry } from '@wbr/content/catalog';
import type { FeedbackReport } from '@wbr/shared/test-feedback';
import { uid } from './context';
import { localizedTitle } from './localization';
import { useTestFeedback } from './test-feedback-provider';

type SceneFeedbackContext = FeedbackReport['context'];
export const TEST_FEEDBACK_COPY = {
  toggle: '反馈问题', title: '内测反馈', close: '关闭反馈',
  intro: '描述操作问题，可使用键盘的语音输入。',
  progress: '已完成 {p0} / {p1} 个检查点', step: '问题发生在第几步',
  explanation: '检查点可能包含多个动作，请在描述中说明具体操作。',
  message: '遇到了什么操作问题', placeholder: '例如：第 2 步拖到目标位置后松手，没有反应。',
  settings: '上传设置', endpoint: '上传网址', token: '测试邀请码',
  save: '保存地址并重试', send: '发送反馈', retry: '重试待发送',
  pending: '待发送 {p0} 条', sending: '正在上传…', sent: '已送达本机后台',
  queued: '已保存在本机，联网或更换地址后会自动重试。',
  newReport: '继续记录新问题', queueTitle: '查看待发送反馈',
  privacy: '仅发送这段描述、场景步骤和设备版本信息，不发送心愿或完整存档。',
  readError: '反馈记录暂时无法读取，请保留当前输入并重试。',
  writeError: '尚未保存到本机，请保留页面并重试。',
  sendError: '上传未成功，反馈仍保存在本机。',
  receiptError: '未收到有效回执，反馈仍保存在本机。',
  connectionError: '请填写 HTTPS 上传网址和测试邀请码。',
  fullError: '待发送反馈已满，请先上传现有反馈。',
  invalidError: '请填写问题描述，并检查步骤编号。',
} as const;

function errorText(error: string | undefined) {
  return error ? ({ read: TEST_FEEDBACK_COPY.readError, write: TEST_FEEDBACK_COPY.writeError,
    send: TEST_FEEDBACK_COPY.sendError, receipt: TEST_FEEDBACK_COPY.receiptError,
    connection: TEST_FEEDBACK_COPY.connectionError, full: TEST_FEEDBACK_COPY.fullError,
    invalid: TEST_FEEDBACK_COPY.invalidError } as Record<string, string>)[error] : undefined;
}

/** Kept beside the existing scene; opening this never replaces its renderer. */
export function TestFeedbackOverlay({ entry, context, reducedMotion, onOpenChange }: {
  entry: CatalogEntry;
  context: SceneFeedbackContext;
  reducedMotion: boolean;
  onOpenChange(open: boolean): void;
}) {
  const feedback = useTestFeedback();
  const trigger = useRef<HTMLButtonElement>(null), dialog = useRef<HTMLDialogElement>(null);
  const textInput = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false), [draft, setDraft] = useState<FeedbackReport>();
  const [endpoint, setEndpoint] = useState(''), [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const dirtyDraft = useRef<{ report: FeedbackReport; revision: number } | undefined>(undefined);
  const draftRevision = useRef(0);
  const snapshot = feedback?.snapshot;
  const currentPending = !!draft && !!snapshot?.pending.some(report => report.id === draft.id);
  const receiptForDraft = !!draft && !!(snapshot?.receipts?.[draft.id] ?? (snapshot?.lastReceipt?.id === draft.id ? snapshot.lastReceipt : undefined));
  const delivered = receiptForDraft && snapshot?.status === 'ready' && !snapshot.saving;
  const createDraft = (): FeedbackReport => ({
    schemaVersion: 1, id: uid(), createdAt: new Date().toISOString(),
    scene: { id: entry.id, title: entry.title, engine: entry.engine, revision: entry.revision },
    context: { ...context }, message: '',
    client: {
      platform: feedback?.info?.platform ?? 'web', appVersion: feedback?.info?.appVersion ?? 'unknown',
      buildNumber: feedback?.info?.buildNumber ?? 'unknown', locale: getFormatLocale(),
      width: window.innerWidth, height: window.innerHeight, pixelRatio: window.devicePixelRatio || 1,
      reducedMotion, ...(feedback?.info?.osVersion ? { osVersion: feedback.info.osVersion } : {}),
    },
  });
  const close = () => { setOpen(false); onOpenChange(false); trigger.current?.focus(); };
  useEffect(() => {
    if (!open || !dialog.current) return;
    const node = dialog.current;
    if (typeof node.showModal === 'function') node.showModal();
    else node.setAttribute('open', '');
    textInput.current?.focus();
    return () => {
      if (typeof node.close === 'function') node.close();
      else node.removeAttribute('open');
    };
  }, [open]);
  const persistDirty = () => {
    const pending = dirtyDraft.current;
    if (!pending || !feedback) return;
    void feedback.client.saveDraft(pending.report).then(saved => {
      if (saved && dirtyDraft.current?.revision === pending.revision) dirtyDraft.current = undefined;
    });
  };
  useEffect(() => {
    // A successful retry may have restored an older disk draft. The newer text
    // typed while storage was unavailable wins, including an intentional clear.
    if (snapshot?.status === 'ready') persistDirty();
  }, [feedback?.client, snapshot?.status]);
  const update = (next: FeedbackReport) => {
    setDraft(next);
    dirtyDraft.current = { report: next, revision: ++draftRevision.current };
    persistDirty();
  };
  const send = async () => {
    if (!feedback || !draft || busy) return;
    setBusy(true);
    try {
      if (!await feedback.client.setConnection({ endpoint, token })) return;
      await feedback.client.enqueue(draft);
    } finally { setBusy(false); }
  };
  if (!feedback) return null;
  const error = errorText(snapshot?.error);
  return <div className="test-feedback-overlay">
    <button ref={trigger} type="button" className="test-feedback-trigger" disabled={snapshot?.status === 'loading'}
      aria-haspopup="dialog" aria-expanded={open} onClick={() => {
        const local = dirtyDraft.current?.report;
        const localDelivered = !!local && !!(snapshot?.receipts?.[local.id] ?? (snapshot?.lastReceipt?.id === local.id ? snapshot.lastReceipt : undefined));
        if (localDelivered) dirtyDraft.current = undefined;
        const next = (!localDelivered ? local : undefined) ?? snapshot?.drafts[entry.id] ??
          (draft?.message.length && !delivered ? draft : createDraft());
        setDraft(next);
        setEndpoint(snapshot?.connection.endpoint ?? ''); setToken(snapshot?.connection.token ?? '');
        setOpen(true); onOpenChange(true);
      }}>{tr(TEST_FEEDBACK_COPY.toggle)}</button>
    {open && draft && <dialog ref={dialog} className="test-feedback-dialog" aria-labelledby="test-feedback-title"
      onCancel={event => { event.preventDefault(); close(); }}>
      <div className="test-feedback-heading">
        <h2 id="test-feedback-title">{tr(TEST_FEEDBACK_COPY.title)}</h2>
        <button type="button" data-feedback-close className="text-button" onClick={close}>{tr(TEST_FEEDBACK_COPY.close)}</button>
      </div>
      <strong>{localizedTitle(entry)}</strong>
      <p>{tr(TEST_FEEDBACK_COPY.progress, { p0: draft.context.completedSteps, p1: draft.context.totalSteps })}</p>
      <p className="quiet">{tr(TEST_FEEDBACK_COPY.intro)}</p>
      <label>{tr(TEST_FEEDBACK_COPY.step)}<input type="number" inputMode="numeric" min={1}
        max={draft.context.totalSteps} value={draft.context.reportedStep} disabled={currentPending || receiptForDraft || delivered}
        onChange={event => update({ ...draft, context: { ...draft.context, reportedStep: Number(event.target.value) } })}/></label>
      <p className="quiet">{tr(TEST_FEEDBACK_COPY.explanation)}</p>
      <label>{tr(TEST_FEEDBACK_COPY.message)}<textarea ref={textInput} rows={4} maxLength={4000}
        placeholder={tr(TEST_FEEDBACK_COPY.placeholder)} value={draft.message} disabled={currentPending || receiptForDraft || delivered}
        onChange={event => update({ ...draft, message: event.target.value })}/></label>
      <details className="test-feedback-settings" open={!snapshot?.connection.endpoint}>
        <summary>{tr(TEST_FEEDBACK_COPY.settings)}</summary>
        <label>{tr(TEST_FEEDBACK_COPY.endpoint)}<input type="url" autoCapitalize="none" autoCorrect="off"
          placeholder={tr(TEST_FEEDBACK_COPY.endpoint)} value={endpoint} onChange={event => setEndpoint(event.target.value)}/></label>
        <label>{tr(TEST_FEEDBACK_COPY.token)}<input type="password" autoComplete="off" autoCapitalize="none"
          value={token} onChange={event => setToken(event.target.value)}/></label>
        <button type="button" className="button secondary" disabled={busy} onClick={() => {
          void feedback.client.setConnection({ endpoint, token });
        }}>{tr(TEST_FEEDBACK_COPY.save)}</button>
      </details>
      <div className="test-feedback-actions">
        <button type="button" className="button" disabled={busy || currentPending || receiptForDraft || delivered || !draft.message.trim()}
          onClick={() => void send()}>{tr(TEST_FEEDBACK_COPY.send)}</button>
        {(currentPending || delivered) && <button type="button" className="button secondary" onClick={() => update(createDraft())}>{tr(TEST_FEEDBACK_COPY.newReport)}</button>}
      </div>
      <div role="status" className="test-feedback-status" aria-live="polite">
        {snapshot?.sending ? tr(TEST_FEEDBACK_COPY.sending) : delivered ? tr(TEST_FEEDBACK_COPY.sent)
          : currentPending ? tr(TEST_FEEDBACK_COPY.queued) : ''}
        {error && <p>{tr(error)}</p>}
        {snapshot?.error === 'read' && <button type="button" className="button secondary" onClick={() => void feedback.client.load()}>{tr('重新读取')}</button>}
      </div>
      {!!snapshot?.pending.length && <details className="test-feedback-queue">
        <summary>{tr(TEST_FEEDBACK_COPY.pending, { p0: snapshot.pending.length })} · {tr(TEST_FEEDBACK_COPY.queueTitle)}</summary>
        <ul>{snapshot.pending.map(report => <li key={report.id}><strong>{localizedTitle(report.scene)}</strong>
          <span> · {tr(TEST_FEEDBACK_COPY.step)} {report.context.reportedStep}</span><p>{report.message}</p></li>)}</ul>
        <button type="button" className="button secondary" disabled={!!snapshot.sending} onClick={() => void feedback.client.flush()}>{tr(TEST_FEEDBACK_COPY.retry)}</button>
      </details>}
      <p className="quiet test-feedback-privacy">{tr(TEST_FEEDBACK_COPY.privacy)}</p>
    </dialog>}
  </div>;
}
