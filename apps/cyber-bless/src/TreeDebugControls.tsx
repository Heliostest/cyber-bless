import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import { debugTrees, type TreeRenderMethod, type TreeSpecies } from '@wbr/scene-runtime/debug-trees';
import { message, translateScene } from '@wbr/i18n';

export function TreeDebugControls({ anchor, hidden }: { anchor: RefObject<HTMLElement | null>; hidden: boolean }) {
  const names: Record<TreeSpecies, string> = {
    original: message('developer.trees.keep'), cherry: message('developer.trees.cherry'),
    cypress: message('developer.trees.cypress'), willow: message('developer.trees.willow'), conifer: message('developer.trees.conifer'),
    toona: message('developer.trees.toona'), acer: message('developer.trees.acer'), maple: message('developer.trees.maple'),
  };
  const snapshot = useSyncExternalStore(debugTrees.subscribe, debugTrees.getSnapshot);
  const [scope, setScope] = useState<Element>();
  const release = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    setScope(anchor.current?.closest('.app-shell') ?? undefined);
    return () => { release.current?.(); release.current = undefined; };
  }, [anchor]);
  const scenes = [...new Map(snapshot.filter(entry => scope && entry.scope === scope && entry.count > 0)
    .map(entry => [entry.id, entry])).values()];
  function select(id: string, method: TreeRenderMethod) {
    if (!scope) return;
    release.current ??= debugTrees.enable(scope); debugTrees.select(id, method, scope);
  }
  return <section hidden={hidden} className="tree-debug-controls" aria-label={message('developer.trees.title')}>
    <strong>{message('developer.trees.title')}</strong>
    {!scenes.length && <p>{message('developer.trees.empty')}</p>}
    {scenes.map(entry => <label key={entry.id}>
      <span>{translateScene(entry.label)}</span>
      <select aria-label={message('developer.trees.title')} data-tree-scene={entry.id} value={entry.method}
        onChange={event => select(entry.id, event.target.value as TreeRenderMethod)}>
        <option value="original">{message('developer.trees.original')}</option>
        <option value="scene">{message('developer.trees.recommended', { species: names[entry.recommendation] })}</option>
        <optgroup label={message('developer.trees.bySource')}>
          <option value="quaternius">{message('developer.trees.quaternius')}</option>
          <option value="simple-tree">{message('developer.trees.simple')}</option>
        </optgroup>
        <optgroup label={message('developer.trees.bySpecies')}>
          <option value="cherry">{names.cherry}</option>
          <option value="cypress">{names.cypress}</option>
          <option value="willow">{names.willow}</option>
          <option value="conifer">{names.conifer}</option>
          <option value="toona">{names.toona}</option>
          <option value="acer">{names.acer}</option>
          <option value="maple">{names.maple}</option>
        </optgroup>
      </select>
      <small role="status" aria-live="polite">{entry.status === 'loading' ? message('developer.trees.loading') :
        entry.status === 'error' ? message('developer.trees.error') : message('developer.trees.count', { count: entry.count })}</small>
      {entry.method === 'scene' && <small>{message('developer.trees.regionalHelp')}</small>}
    </label>)}
    {!!scenes.length && <p>{message('developer.trees.help')}</p>}
    {scenes.some(entry => entry.method !== 'scene') && <button type="button" className="audio-debug-stop"
      data-tree-reset="" onClick={() => { release.current?.(); release.current = undefined; }}>
      {message('developer.trees.restore')}
    </button>}
  </section>;
}
