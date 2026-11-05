import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import { debugWater, type WaterRenderMethod } from '@wbr/scene-runtime/debug-water';
import { message, translateScene } from '@wbr/i18n';

/** Always mounted with the console, so collapsing it preserves the live preview. */
export function WaterDebugControls({ anchor, hidden }: { anchor: RefObject<HTMLElement | null>; hidden: boolean }) {
  const snapshot = useSyncExternalStore(debugWater.subscribe, debugWater.getSnapshot);
  const [scope, setScope] = useState<Element>();
  const release = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    setScope(anchor.current?.closest('.app-shell') ?? undefined);
    return () => { release.current?.(); release.current = undefined; };
  }, [anchor]);
  const scenes = [...new Map(snapshot.filter(entry => scope && entry.scope === scope && entry.surfaces > 0)
    .map(entry => [entry.id, entry])).values()];
  function select(id: string, method: WaterRenderMethod) {
    if (!scope) return;
    release.current ??= debugWater.enable(scope);
    debugWater.select(id, method, scope);
  }
  return <section hidden={hidden} className="water-debug-controls" aria-label={message('developer.water.title')}>
    <strong>{message('developer.water.title')}</strong>
    {!scenes.length && <p>{message('developer.water.empty')}</p>}
    {scenes.map(entry => <label key={entry.id}>
      <span>{translateScene(entry.label)}</span>
      <select aria-label={message('developer.water.title')} data-water-scene={entry.id} value={entry.method}
        onChange={event => select(entry.id, event.target.value as WaterRenderMethod)}>
        <option value="original">{message('developer.water.original')}</option>
        <option value="toon-water">{message('developer.water.toon')}</option>
      </select>
      <small>{message('developer.water.count', { count: entry.surfaces })}</small>
    </label>)}
    {!!scenes.length && <p>{message('developer.water.help')}</p>}
    {scenes.some(entry => entry.method !== 'original') && <button type="button" className="audio-debug-stop"
      data-water-reset="" onClick={() => { release.current?.(); release.current = undefined; }}>
      {message('developer.water.restore')}
    </button>}
  </section>;
}
