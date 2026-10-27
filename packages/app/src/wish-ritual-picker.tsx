import { sceneIntention } from "@wbr/core";
import { Icon } from "./art";
import { useApp } from "./context";
import { useOpenScene, useSceneLibrary } from "./scene-library";
import { SceneBadge } from "./scene-icons";
import { pendingVessels, usableVessels, VESSEL_COPY } from "./vessels";

/** The same completed-scene writing flow, with or without a collected object. */
export function WishRitualPicker() {
  const { state } = useApp();
  const { entries } = useSceneLibrary();
  const openScene = useOpenScene();
  // Old held lines remain reachable even when their scene no longer offers writing.
  const pending = pendingVessels(state, entries);
  const vessels = usableVessels(state, entries).filter(c =>
    !!sceneIntention(c.sceneId!)?.optionalWish);
  const heldScenes = new Set([...pending, ...vessels].map(c => c.sceneId));
  const scenes = entries.filter(entry => {
    const intention = sceneIntention(entry.id);
    return intention?.kind === "wish" && intention.optionalWish && !heldScenes.has(entry.id);
  });
  const vesselRows = (items: typeof vessels, pendingChoice = false) => (
    <div className="wish-practice-grid">
      {items.map(item => {
        const entry = entries.find(e => e.id === item.sceneId)!;
        return <button key={item.id} type="button"
          className="wish-practice-card vessel-card" data-scene={entry.id}
          onClick={() => openScene(entry, { vessel: item.id })}>
          <SceneBadge id={entry.id} />
          <strong>{entry.title}</strong>
          <small>{pendingChoice ? VESSEL_COPY.pending : VESSEL_COPY.use}</small>
          <Icon name="arrow" />
        </button>;
      })}
    </div>
  );
  return <div id="vessel-picker" className="wish-ritual-picker">
    {pending.length > 0 && <section aria-label="接着刚才">
      <h2>接着刚才</h2>
      {vesselRows(pending, true)}
    </section>}
    {vessels.length > 0 && <section aria-label={VESSEL_COPY.heading}>
      <h2>{VESSEL_COPY.heading}</h2>
      {vesselRows(vessels)}
    </section>}
    {scenes.length > 0 && <section aria-label="开始一场小仪式">
      {(pending.length > 0 || vessels.length > 0) && <h2>也可以从这里开始</h2>}
      <div className="wish-practice-grid">
        {scenes.map(entry => <button key={entry.id} type="button"
          className="wish-practice-card wish-scene-choice" data-scene={entry.id}
          onClick={() => openScene(entry)}>
          <SceneBadge id={entry.id} />
          <strong>{entry.title}</strong>
          <Icon name="arrow" />
        </button>)}
      </div>
    </section>}
    {!pending.length && !vessels.length && !scenes.length &&
      <p className="quiet">暂时没有可开始的仪式，请稍后再来。</p>}
  </div>;
}
