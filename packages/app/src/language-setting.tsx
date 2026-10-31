import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { configureLocale, getFormatLocale, SUPPORTED_LOCALES, LOCALE_NAMES, subscribeLocale, message, translate as tr, type LocalePreference } from '@wbr/i18n';
import { Icon } from './art';
import { useApp } from './context';

const dismissEvent = 'wbr:close-language-setting';
export function dismissLanguageSetting(scope?: HTMLElement | null): boolean {
  return !document.dispatchEvent(new CustomEvent(dismissEvent, { cancelable: true, detail: scope }));
}

export function LanguageSetting() {
  useSyncExternalStore(subscribeLocale, getFormatLocale, getFormatLocale);
  const { state, dispatch } = useApp();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null), dialog = useRef<HTMLDialogElement>(null);
  const id = useId(), headingId = `${id}-heading`, descriptionId = `${id}-description`;
  const preference = state.settings.locale ?? 'system';
  const name = (value: LocalePreference) => value === 'system' ? message('app.language.system') : LOCALE_NAMES[value];
  const close = useCallback(() => {
    dialog.current?.close();
    setOpen(false);
    trigger.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const element = dialog.current!;
    const shell = trigger.current?.closest<HTMLElement>('.app-shell');
    const bodyOverflow = document.body.style.overflow, shellOverflow = shell?.style.overflow;
    document.body.style.overflow = 'hidden';
    if (shell) shell.style.overflow = 'hidden';
    element.showModal();
    element.querySelector<HTMLInputElement>('input:checked')?.focus();
    const dismiss = (event: Event) => {
      const scope = (event as CustomEvent<HTMLElement | null>).detail;
      if (scope && !scope.contains(element)) return;
      event.preventDefault(); close();
    };
    document.addEventListener(dismissEvent, dismiss);
    return () => {
      document.removeEventListener(dismissEvent, dismiss);
      if (element.open) element.close();
      document.body.style.overflow = bodyOverflow;
      if (shell) shell.style.overflow = shellOverflow ?? '';
      trigger.current?.focus();
    };
  }, [open, close]);

  function choose(value: LocalePreference) {
    if (value !== preference && dispatch({ type: 'settings.locale', value })) configureLocale(value);
    close();
  }

  return <>
    <div className="settings-row language-setting">
      <span id={headingId}>{message('app.language.label')}<small>{message('app.language.description')}</small></span>
      <button ref={trigger} type="button" className="language-setting-trigger" aria-labelledby={`${headingId} ${id}-value`}
        aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <span id={`${id}-value`} lang={preference === 'system' ? undefined : preference}>{name(preference)}</span><Icon name="arrow"/>
      </button>
    </div>
    {open && <dialog ref={dialog} className="language-dialog" aria-labelledby={`${id}-title`} aria-describedby={descriptionId}
      onCancel={event => { event.preventDefault(); close(); }} onClose={() => setOpen(false)}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const box = event.currentTarget.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
      }}>
      <div className="language-dialog-heading">
        <div><h2 id={`${id}-title`}>{message('app.language.label')}</h2><p id={descriptionId}>{message('app.language.description')}</p></div>
        <button type="button" className="language-dialog-close" aria-label={tr('关闭')} onClick={close}><Icon name="close"/></button>
      </div>
      <div className="language-dialog-options" role="radiogroup" aria-labelledby={`${id}-title`}>
        {(['system', ...SUPPORTED_LOCALES] as const).map(value => <label key={value} className="language-dialog-option">
          <input type="radio" name={`${id}-locale`} value={value} checked={value === preference}
            onChange={() => choose(value)} onClick={() => { if (value === preference) close(); }}/>
          <span lang={value === 'system' ? undefined : value}>{name(value)}</span>
          <span className="language-dialog-check" aria-hidden="true">{value === preference && <Icon name="check"/>}</span>
        </label>)}
      </div>
    </dialog>}
  </>;
}
