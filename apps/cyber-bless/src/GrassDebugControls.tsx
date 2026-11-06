import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import { debugGrass, type GrassRenderMethod } from '@wbr/scene-runtime/debug-grass';
import { message } from '@wbr/i18n';

export function GrassDebugControls({ anchor, hidden }: { anchor: RefObject<HTMLElement | null>; hidden: boolean }) {
  const snapshot = useSyncExternalStore(debugGrass.subscribe, debugGrass.getSnapshot);
  const [scope, setScope] = useState<Element>();
  const release = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    setScope(anchor.current?.closest('.app-shell') ?? undefined);
    return () => { release.current?.(); release.current = undefined; };
  }, [anchor]);
  const scenes = snapshot.filter(entry => scope && entry.scope === scope);
  function select(method: GrassRenderMethod) {
    if (!scope) return;
    release.current ??= debugGrass.enable(scope); debugGrass.select(method, scope);
  }
  return <section hidden={hidden} className="grass-debug-controls" aria-label={message('developer.grass.title')}>
    <strong>{message('developer.grass.title')}</strong>
    {!scenes.length ? <p>{message('developer.grass.empty')}</p> : <>
      <label><span>{message('developer.grass.title')}</span>
        <select aria-label={message('developer.grass.title')} value={scenes[0].method}
          onChange={event => select(event.target.value as GrassRenderMethod)}>
          <option value="original">{message('developer.grass.original')}</option>
          <option value="komorebi">{message('developer.grass.komorebi')}</option>
        </select>
      </label>
      <p>{message('developer.grass.help')}</p>
    </>}
  </section>;
}
