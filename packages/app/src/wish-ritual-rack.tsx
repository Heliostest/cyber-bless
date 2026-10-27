import { useId, useState } from "react";
import { sceneIntention } from "@wbr/core";
import { formatDate, useApp } from "./context";
import { supportsScene, useOpenScene, useSceneLibrary } from "./scene-library";
import { hasSceneIcon, SceneIcon } from "./scene-icons";
import { Icon } from "./art";

/** A hanging display of actual collected objects; each copy keeps its own usage. */
export function WishRitualRack() {
  const { state, go } = useApp();
  const { entries } = useSceneLibrary();
  const openScene = useOpenScene();
  const [expanded, setExpanded] = useState(false);
  const rackId = useId();
  const items = [...state.collectibles].reverse().flatMap(item => {
    if (item.kind !== "scene" || !item.wishScene || !item.sceneId) return [];
    const entry = entries.find(entry => entry.id === item.sceneId);
    if (!entry) return [];
    const status = item.spentAt
      ? state.vesselDrafts?.[item.id] ? "pending" as const : "used" as const
      : "unused" as const;
    return [{ item, entry, status }];
  }).sort((a, b) => {
    const rank = { pending: 0, unused: 1, used: 2 };
    return rank[a.status] - rank[b.status];
  });
  if (!items.length) return null;
  const unused = items.filter(({ status }) => status === "unused").length;
  const shown = expanded ? items : items.slice(0, 3);
  const rows = Array.from({ length: Math.ceil(shown.length / 3) }, (_, i) => shown.slice(i * 3, i * 3 + 3));
  return <section className="wish-ritual-rack" aria-label="已获得的祈愿仪式">
    <header className="wish-rack-heading">
      <h2>收下的祈愿</h2>
      <span className="wish-rack-count">{unused} 个未用</span>
      {items.length > 3 && <button type="button" className="text-button wish-rack-toggle"
        aria-controls={rackId} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
        {expanded ? "收起" : `全部 ${items.length} 件`}
      </button>}
    </header>
    <div id={rackId} className="wish-rack-hangers">
      {rows.map((row, index) => <div className="wish-rack-row" key={index}>
        {row.map(({ item, entry, status }) => {
          const label = status === "pending" ? "接着刚才" : status === "unused" ? "未用" : "已用";
          const canOpen = supportsScene(entry.engine) &&
            (status === "pending" || (status === "unused" && sceneIntention(entry.id)?.optionalWish));
          return <button key={item.id} type="button" className="wish-rack-item"
            data-scene={entry.id} data-collectible-id={item.id} data-rack-status={status}
            aria-label={`${entry.title}，${label}，${formatDate(item.at)}收下，${canOpen ? "进入仪式" : "查看收藏"}`}
            onClick={() => canOpen ? openScene(entry, { vessel: item.id }) : go({ page: "collection", id: item.id })}>
            <span className="wish-rack-charm" aria-hidden="true">
              {hasSceneIcon(entry.id) ? <SceneIcon id={entry.id} /> : <Icon name="leaf" />}
            </span>
            <strong>{entry.title}</strong>
            <span className="wish-rack-status">{label}</span>
          </button>;
        })}
      </div>)}
    </div>
  </section>;
}
