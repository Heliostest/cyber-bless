import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { message, translate as tr } from '@wbr/i18n';
import { useApp, type InspectableSound } from '../../../packages/app/src/context';
import { UI_SOUND_FILES } from '../../../packages/app/src/ui-sound-assets';
import './audio-debug-console.css';

const cues = new Set<string>([...Object.keys(UI_SOUND_FILES), 'woodfish', 'paper', 'water',
  'woodTap', 'beans', 'chime', 'glass', 'ceramic', 'fabric', 'metal', 'stone', 'hollow', 'air']);
type Target = { element: HTMLElement; parent: HTMLElement; cue: InspectableSound };

function visibleRect(element: HTMLElement) {
  if (!element.isConnected || element.closest('[hidden], [inert], [aria-hidden="true"]') || element.matches(':disabled, [aria-disabled="true"]') ||
    element.querySelector('input:disabled')) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  let left = Math.max(0, rect.left), top = Math.max(0, rect.top);
  let right = Math.min(window.innerWidth, rect.right), bottom = Math.min(window.innerHeight, rect.bottom);
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return null;
    if (node !== element && /(auto|scroll|hidden|clip)/.test(`${style.overflow} ${style.overflowX} ${style.overflowY}`)) {
      const clip = node.getBoundingClientRect();
      left = Math.max(left, clip.left); right = Math.min(right, clip.right);
      top = Math.max(top, clip.top); bottom = Math.min(bottom, clip.bottom);
    }
  }
  return right - left >= 12 && bottom - top >= 12 ? { left, top, right, bottom } : null;
}

function nameOf(element: HTMLElement) {
  const labelled = element.getAttribute('aria-labelledby')?.split(/\s+/).map(id => document.getElementById(id)?.textContent ?? '').join(' ');
  return (element.getAttribute('aria-label') || labelled || element.textContent || element.getAttribute('title') || element.tagName)
    .replace(/\s+/g, ' ').trim().slice(0, 72);
}

function Speaker() {
  return <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
    <path d="M3 9h4l5-4v14l-5-4H3zM16 8q5 4 0 8M19 5q8 7 0 14"/>
  </svg>;
}

function SoundTooltip({ id, target, anchor, onEnter, onLeave }: {
  id: string; target: Target; anchor: HTMLButtonElement;
  onEnter(): void; onLeave(): void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Native modal dialogs are in the top layer. Keep their tooltip in that layer;
  // elsewhere use the body so a card or scrolling strip cannot crop the text.
  const parent = target.element.closest<HTMLElement>('dialog, [role="dialog"]') ?? document.body;
  const file = Object.hasOwn(UI_SOUND_FILES, target.cue) ? UI_SOUND_FILES[target.cue as keyof typeof UI_SOUND_FILES] : undefined;
  useLayoutEffect(() => {
    const tooltip = ref.current!;
    let frame = 0;
    const place = () => {
      const bounds = parent === document.body ? { left: 0, top: 0, right: innerWidth, bottom: innerHeight } : visibleRect(parent);
      const visible = visibleRect(target.element);
      tooltip.style.visibility = bounds && visible ? 'visible' : 'hidden';
      if (bounds && visible) {
        const button = anchor.getBoundingClientRect();
        const current = tooltip.getBoundingClientRect();
        const scale = tooltip.offsetWidth ? current.width / tooltip.offsetWidth : 1;
        if (scale > 0) {
          tooltip.style.maxWidth = `${Math.max(0, bounds.right - bounds.left - 16) / scale}px`;
          const box = tooltip.getBoundingClientRect();
          const x = Math.max(bounds.left + 8, Math.min(button.right - box.width, bounds.right - box.width - 8));
          const above = button.top - box.height - 8;
          const y = Math.max(bounds.top + 8, Math.min(above >= bounds.top + 8 ? above : button.bottom + 8, bounds.bottom - box.height - 8));
          if (Math.abs(x - box.left) > .5) tooltip.style.left = `${(parseFloat(tooltip.style.left) || 0) + (x - box.left) / scale}px`;
          if (Math.abs(y - box.top) > .5) tooltip.style.top = `${(parseFloat(tooltip.style.top) || 0) + (y - box.top) / scale}px`;
        }
      }
      frame = requestAnimationFrame(place);
    };
    place();
    return () => cancelAnimationFrame(frame);
  }, [anchor, parent, target.element]);
  return createPortal(<div ref={ref} id={id} role="tooltip" className="audio-debug-tooltip" data-audio-inspector=""
    onPointerEnter={onEnter} onPointerLeave={onLeave}>
    <span className="audio-debug-tooltip-operation">{nameOf(target.element)}</span>
    <div className="audio-debug-tooltip-cue"><span>{message(file ? 'developer.audio.clip' : 'developer.audio.synth')}</span><strong>{target.cue}</strong></div>
    <code>{file ?? message('developer.audio.synthSource')}</code>
  </div>, parent);
}

function Marker({ target, onPlay }: { target: Target; onPlay(cue: InspectableSound): void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const tooltipId = useId();
  const [hint, setHint] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const showHint = () => { clearTimeout(hideTimer.current); setHint(true); };
  const hideHint = () => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => { if (document.activeElement !== ref.current) setHint(false); }, 120);
  };
  useEffect(() => () => clearTimeout(hideTimer.current), []);
  useEffect(() => {
    if (!hint) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation();
      clearTimeout(hideTimer.current); setHint(false);
    };
    window.addEventListener('keydown', dismiss, true);
    return () => window.removeEventListener('keydown', dismiss, true);
  }, [hint]);
  useLayoutEffect(() => {
    const button = ref.current!, element = target.element;
    let frame = 0;
    element.setAttribute('data-audio-marked', '');
    const place = () => {
      const rect = visibleRect(element);
      button.style.visibility = rect ? 'visible' : 'hidden';
      if (rect) {
        // Measure the portal in its actual containing block. This also handles
        // transformed dialogs, scaled previews and ancestors scrolling underneath it.
        const box = button.getBoundingClientRect();
        const scale = button.offsetWidth ? box.width / button.offsetWidth : 1;
        if (scale > 0) {
          const x = Math.max(2, Math.min(window.innerWidth - box.width - 2, rect.right - box.width + 7));
          const y = Math.max(2, Math.min(window.innerHeight - box.height - 2, rect.top - 7));
          if (Math.abs(x - box.left) > .5) button.style.left = `${(parseFloat(button.style.left) || 0) + (x - box.left) / scale}px`;
          if (Math.abs(y - box.top) > .5) button.style.top = `${(parseFloat(button.style.top) || 0) + (y - box.top) / scale}px`;
        }
      }
      frame = requestAnimationFrame(place);
    };
    place();
    return () => { cancelAnimationFrame(frame); element.removeAttribute('data-audio-marked'); };
  }, [target.element, target.parent]);
  const label = message('developer.audio.preview', { name: nameOf(target.element), cue: target.cue });
  // A sibling portal stays inside the real modal/event boundary, without putting
  // a button inside another button/label or changing the original layout.
  return <>{createPortal(<button ref={ref} type="button" className="audio-debug-marker" data-audio-inspector=""
    data-audio-preview={target.cue} aria-label={label} aria-describedby={hint ? tooltipId : undefined}
    onPointerEnter={event => { if (event.pointerType !== 'touch') showHint(); }} onPointerLeave={hideHint}
    onFocus={showHint} onBlur={hideHint}
    onPointerDown={event => { event.preventDefault(); event.stopPropagation(); }}
    onPointerUp={event => event.stopPropagation()}
    onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') event.stopPropagation(); }}
    onClick={event => { event.preventDefault(); event.stopPropagation(); onPlay(target.cue); }}><Speaker /></button>, target.parent)}
    {hint && ref.current && <SoundTooltip id={tooltipId} target={target} anchor={ref.current} onEnter={showHint} onLeave={hideHint}/>}</>;
}

export default function AudioDebugConsole() {
  const { state, audioInspector } = useApp();
  const anchor = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false), [enabled, setEnabled] = useState(false);
  const [targets, setTargets] = useState<Target[]>([]), [status, setStatus] = useState('');
  const ids = useRef(new WeakMap<HTMLElement, number>()), nextId = useRef(0);
  useEffect(() => setStatus(''), [state.settings.sound]);
  useEffect(() => {
    if (!enabled || !audioInspector) return;
    const root = anchor.current?.closest('.app-shell');
    if (!root) return;
    const scan = () => {
      let modal: Element | undefined;
      try { modal = [...root.querySelectorAll('dialog:modal')].at(-1); } catch { /* Older WebViews. */ }
      modal ??= [...root.querySelectorAll('[role="dialog"][aria-modal="true"]')].at(-1);
      const next = [...root.querySelectorAll<HTMLElement>('[data-audio-cue]')].flatMap(element => {
        const cue = element.dataset.audioCue;
        if (!cue || !cues.has(cue) || !element.parentElement || (modal && !modal.contains(element)) || !visibleRect(element)) return [];
        if (!ids.current.has(element)) ids.current.set(element, ++nextId.current);
        const parent = element.tagName === 'SUMMARY' ? element.parentElement.parentElement : element.parentElement;
        return parent ? [{ element, parent, cue: cue as InspectableSound }] : [];
      });
      setTargets(old => old.length === next.length && old.every((item, index) =>
        item.element === next[index].element && item.parent === next[index].parent && item.cue === next[index].cue) ? old : next);
    };
    scan();
    const observer = new MutationObserver(records => {
      if (records.some(record => !(record.target instanceof Element && record.target.closest('[data-audio-inspector]')))) scan();
    });
    observer.observe(root, { subtree: true, childList: true, attributes: true,
      attributeFilter: ['data-audio-cue', 'disabled', 'hidden', 'inert', 'aria-hidden', 'open', 'class', 'style'] });
    document.addEventListener('scroll', scan, true); window.addEventListener('resize', scan);
    root.addEventListener('animationend', scan, true); root.addEventListener('transitionend', scan, true);
    return () => {
      observer.disconnect(); document.removeEventListener('scroll', scan, true); window.removeEventListener('resize', scan);
      root.removeEventListener('animationend', scan, true); root.removeEventListener('transitionend', scan, true);
      audioInspector.stop();
    };
  }, [enabled, audioInspector]);
  if (!audioInspector) return null;
  const play = (cue: InspectableSound) => {
    const result = audioInspector.play(cue);
    setStatus(result === 'disabled' ? message('developer.audio.muted') : result === 'unready' ? message('developer.audio.unready')
      : result === 'unavailable' ? message('developer.audio.unavailable') : result === 'busy' ? message('developer.audio.busy')
        : message(result === 'requested' ? 'developer.audio.requested' : 'developer.audio.playing', { cue }));
  };
  return <>
    <aside ref={anchor} className="audio-debug-console" data-audio-inspector="" aria-label={message('developer.audio.console')}>
      <button type="button" data-audio-console-toggle="" aria-expanded={open} onClick={() => {
        setOpen(!open);
      }}><Speaker /><span>{message('developer.audio.console')}</span>{enabled && !open && <output>{targets.length}</output>}<span aria-hidden="true">{open ? '−' : '+'}</span></button>
      {open && <section>
        <button type="button" data-audio-filter="" aria-pressed={enabled} onClick={() => {
          audioInspector.prepare(); setEnabled(!enabled); setStatus('');
        }}><span>{message('developer.audio.filter')}</span><i aria-hidden="true" /></button>
        <p>{message('developer.audio.help')}</p>
        <small>{message('developer.audio.scope')}</small>
        {enabled && <output>{message('developer.audio.count', { count: targets.length })}</output>}
        {!state.settings.sound && <p className="audio-debug-muted">{message('developer.audio.muted')}</p>}
        <p role="status" aria-live="polite">{status}</p>
        {enabled && <button type="button" className="audio-debug-stop" onClick={() => { setEnabled(false); setStatus(''); }}>{tr('关闭')}</button>}
      </section>}
    </aside>
    {enabled && targets.map(target => <Marker key={ids.current.get(target.element)} target={target} onPlay={play}/>)}
  </>;
}
