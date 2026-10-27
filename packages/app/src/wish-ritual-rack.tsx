import { localizedTitle } from './localization';
import { translate as tr, message } from '@wbr/i18n';
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
        if (item.kind !== "scene" || !item.wishScene || !item.sceneId)
            return [];
        const entry = entries.find(entry => entry.id === item.sceneId);
        if (!entry)
            return [];
        const status = item.spentAt
            ? state.vesselDrafts?.[item.id] ? "pending" as const : "used" as const
            : "unused" as const;
        return [{ item, entry, status }];
    }).sort((a, b) => {
        const rank = { pending: 0, unused: 1, used: 2 };
        return rank[a.status] - rank[b.status];
    });
    if (!items.length)
        return null;
    const unused = items.filter(({ status }) => status === "unused").length;
    const shown = expanded ? items : items.slice(0, 3);
    const rows = Array.from({ length: Math.ceil(shown.length / 3) }, (_, i) => shown.slice(i * 3, i * 3 + 3));
    return <section className="wish-ritual-rack" aria-label={tr("\u5DF2\u83B7\u5F97\u7684\u7948\u613F\u4EEA\u5F0F")}>
    <header className="wish-rack-heading">
      <h2>{tr("\u6536\u4E0B\u7684\u7948\u613F")}</h2>
      <span className="wish-rack-count">{message('app.vessels.unused.count', { n: unused })}</span>
      {items.length > 3 && <button type="button" className="text-button wish-rack-toggle" aria-controls={rackId} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
        {expanded ? tr("\u6536\u8D77") : tr("\u5168\u90E8 {p0} \u4EF6", { p0: items.length })}
      </button>}
    </header>
    <div id={rackId} className="wish-rack-hangers">
      {rows.map((row, index) => <div className="wish-rack-row" key={index}>
        {row.map(({ item, entry, status }) => {
                const label = status === "pending" ? tr("\u63A5\u7740\u521A\u624D") : status === "unused" ? tr("\u672A\u7528") : tr("\u5DF2\u7528");
                const canOpen = supportsScene(entry.engine) &&
                    (status === "pending" || (status === "unused" && sceneIntention(entry.id)?.optionalWish));
                return <button key={item.id} type="button" className="wish-rack-item" data-scene={entry.id} data-collectible-id={item.id} data-rack-status={status} aria-label={tr("{p0}\uFF0C{p1}\uFF0C{p2}\u6536\u4E0B\uFF0C{p3}", { p0: localizedTitle(entry), p1: label, p2: formatDate(item.at), p3: canOpen ? tr("\u8FDB\u5165\u4EEA\u5F0F") : tr("\u67E5\u770B\u6536\u85CF") })} onClick={() => canOpen ? openScene(entry, { vessel: item.id }) : go({ page: "collection", id: item.id })}>
            <span className="wish-rack-charm" aria-hidden="true">
              {hasSceneIcon(entry.id) ? <SceneIcon id={entry.id}/> : <Icon name="leaf"/>}
            </span>
            <strong>{localizedTitle(entry)}</strong>
            <span className="wish-rack-status">{label}</span>
          </button>;
            })}
      </div>)}
    </div>
  </section>;
}
