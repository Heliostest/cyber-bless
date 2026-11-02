import { localizedTitle } from './localization';
import { translate as tr } from '@wbr/i18n';
import { sceneIntention } from "@wbr/core";
import { Icon } from "./art";
import { useApp } from "./context";
import { useOpenScene, useSceneLibrary } from "./scene-library";
import { SceneBadge } from "./scene-icons";
import { isWishCollectionScene, isWishSceneUnlocked, pendingVessels, usableVessels, VESSEL_COPY } from "./vessels";
/** Collected objects and the matching unlocked rituals share the completed-scene writing flow. */
export function WishRitualPicker() {
    const { state } = useApp();
    const { entries } = useSceneLibrary();
    const openScene = useOpenScene();
    // Old held lines remain reachable even when their scene no longer offers writing.
    const pending = pendingVessels(state, entries);
    const vessels = usableVessels(state, entries).filter(c => !!sceneIntention(c.sceneId!)?.optionalWish);
    const heldScenes = new Set([...pending, ...vessels].map(c => c.sceneId));
    const scenes = entries.filter(entry => {
        const intention = sceneIntention(entry.id);
        return isWishCollectionScene(entry.id) && !!intention?.optionalWish && !heldScenes.has(entry.id);
    });
    const unlockedScenes = scenes.filter(entry => isWishSceneUnlocked(state, entry.id));
    const lockedScenes = scenes.filter(entry => !isWishSceneUnlocked(state, entry.id));
    const vesselRows = (items: typeof vessels, pendingChoice = false) => (<div className="wish-practice-grid">
      {items.map(item => {
            const entry = entries.find(e => e.id === item.sceneId)!;
            return <button key={item.id} type="button" className="wish-practice-card vessel-card" data-scene={entry.id} onClick={() => openScene(entry, { vessel: item.id, sound: 'navigate' })}>
          <SceneBadge id={entry.id}/>
          <strong>{localizedTitle(entry)}</strong>
          <small>{tr(pendingChoice ? VESSEL_COPY.pending : VESSEL_COPY.use)}</small>
          <Icon name="arrow"/>
        </button>;
        })}
    </div>);
    const sceneRows = (items: typeof scenes, unlocked: boolean) => (<div className="wish-practice-grid">
      {items.map(entry => <button key={entry.id} type="button" className="wish-practice-card wish-scene-choice" data-scene={entry.id}
        data-unlocked={unlocked} disabled={!unlocked} onClick={() => openScene(entry, { wishPicker: true, sound: 'navigate' })}>
        <SceneBadge id={entry.id}/>
        <strong>{localizedTitle(entry)}</strong>
        <small className="wish-scene-access"><Icon name={unlocked ? 'check' : 'lock'}/>{tr(unlocked ? '已解锁' : '未解锁')}</small>
      </button>)}
    </div>);
    return <div id="vessel-picker" className="wish-ritual-picker">
    {unlockedScenes.length > 0 && <section aria-label={tr('已解锁')}>
      <h2>{tr('已解锁')}</h2>
      {sceneRows(unlockedScenes, true)}
    </section>}
    {pending.length > 0 && <section aria-label={tr("\u63A5\u7740\u521A\u624D")}>
      <h2>{tr("\u63A5\u7740\u521A\u624D")}</h2>
      {vesselRows(pending, true)}
    </section>}
    {vessels.length > 0 && <section aria-label={tr(VESSEL_COPY.heading)}>
      <h2>{tr(VESSEL_COPY.heading)}</h2>
      {vesselRows(vessels)}
    </section>}
    {lockedScenes.length > 0 && <section aria-label={tr('未解锁')}>
      <h2>{tr('未解锁')}</h2>
      <p className="quiet wish-picker-unlock-note">{tr("完成一次仪式后解锁")}</p>
      {sceneRows(lockedScenes, false)}
    </section>}
    {!pending.length && !vessels.length && !scenes.length &&
            <p className="quiet">{tr("\u6682\u65F6\u6CA1\u6709\u53EF\u5F00\u59CB\u7684\u4EEA\u5F0F\uFF0C\u8BF7\u7A0D\u540E\u518D\u6765\u3002")}</p>}
  </div>;
}
