import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import { debugEnvironmentTone, type EnvironmentTone } from '@wbr/scene-runtime/debug-environment-tone';
import { message } from '@wbr/i18n';

export function EnvironmentToneControls({ anchor, hidden }: { anchor: RefObject<HTMLElement | null>; hidden: boolean }) {
  const snapshot = useSyncExternalStore(debugEnvironmentTone.subscribe, debugEnvironmentTone.getSnapshot);
  const [scope, setScope] = useState<Element>();
  const release = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    setScope(anchor.current?.closest('.app-shell') ?? undefined);
    return () => { release.current?.(); release.current = undefined; };
  }, [anchor]);
  const scenes = snapshot.filter(entry => scope && entry.scope === scope);
  function select(tone: EnvironmentTone) {
    if (!scope) return;
    release.current ??= debugEnvironmentTone.enable(scope);
    debugEnvironmentTone.select(tone, scope);
  }
  return <section hidden={hidden} className="environment-tone-controls" aria-label={message('developer.environment.title')}>
    <strong>{message('developer.environment.title')}</strong>
    {!scenes.length ? <p>{message('developer.environment.empty')}</p> : <>
      <label><span>{message('developer.environment.palette')}</span>
        <select aria-label={message('developer.environment.palette')} value={scenes[0].tone}
          onChange={event => select(event.target.value as EnvironmentTone)}>
          <option value="original">{message('developer.environment.original')}</option>
          <option value="tiny-delivery">{message('developer.environment.delivery')}</option>
        </select>
      </label>
      <div className="environment-tone-swatches" aria-hidden="true" data-tone={scenes[0].tone}>
        <i/><i/><i/><i/>
      </div>
      <p>{message('developer.environment.help')}</p>
    </>}
  </section>;
}
