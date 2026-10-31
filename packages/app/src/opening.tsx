import { localizedTitle } from './localization';
import { translate as tr, message } from '@wbr/i18n';
import { useEffect, type ReactNode } from 'react';
import { chooseOpeningScenes, localDay } from '@wbr/core';
import type { CatalogEntry } from '@wbr/content/catalog';
import { builtInScenes, useOpenScene } from './scene-library';
import { SceneArt, SceneBadge } from './scene-icons';
import { Icon } from './art';
import { now, useApp } from './context';
import { PageHead } from './page-heading';
const lessons = [
    { title: '跟着提示动一动' },
    { title: '把小物收进小天地' },
    { title: '为自己留个心愿' },
];
export function Opening() {
    const { state, dispatch, go } = useApp();
    const opening = state.opening;
    const openScene = useOpenScene();
    useEffect(() => {
        if (opening?.status === 'new')
            dispatch({ type: 'opening.start', sceneIds: chooseOpeningScenes(builtInScenes) });
    }, [opening?.status]);
    if (!opening || opening.status === 'complete')
        return null;
    if (opening.status === 'new')
        return <p role="status">{tr("\u6B63\u5728\u51C6\u5907\u4E09\u573A\u5C0F\u4EEA\u5F0F\u2026")}</p>;
    const entries = opening.sceneIds.map(id => builtInScenes.find(e => e.id === id)!);
    const done = opening.completed === 3;
    const current = entries[opening.completed];
    const progress = state.sceneRecords.find(r => r.id === current?.id)?.progress ?? 0;
    return <div className="opening-page">
    <PageHead title={done ? tr("\u5C0F\u5929\u5730\u51C6\u5907\u597D\u4E86") : tr("\u521D\u6B21\u89C1\u9762")} eyebrow={done ? tr("\u8FD9\u4E09\u573A\u5DF2\u7559\u597D\uFF0C\u60F3\u73A9\u65F6\u968F\u65F6\u56DE\u6765\u3002") : tr("\u4E09\u573A\u5C0F\u4EEA\u5F0F\uFF0C\u5F00\u542F\u4F60\u7684\u5C0F\u5929\u5730\u3002")}/>
    {!done && <ol className="opening-track" aria-label={tr("\u5F00\u573A\u8FDB\u5EA6")}>
      {entries.map((entry, index) => <li key={entry.id} aria-current={index === opening.completed ? 'step' : undefined} data-complete={index < opening.completed}>
        <SceneBadge id={entry.id}/>
        <span className="opening-step-mark">{index < opening.completed ? <Icon name="check"/> : index + 1}</span>
        <small>{index === 2 ? tr("\u7948\u613F") : tr("\u7948\u798F")}</small>
      </li>)}
    </ol>}
    {done ? <section className="opening-summary">
      <div className="opening-keepsakes">
        {entries.map(entry => <div key={entry.id}><SceneArt id={entry.id}/><strong>{localizedTitle(entry)}</strong><small>{tr("\u5DF2\u6536\u8FDB\u5C0F\u5929\u5730")}</small></div>)}
      </div>
      <p>{tr("\u9996\u9875\u53EF\u4EE5\u518D\u8D70\u8FD9\u4E09\u573A\uFF0C\u4E5F\u6709\u4E00\u573A\u65B0\u7684\u4ECA\u65E5\u4EEA\u5F0F\u3002")}</p>
      <button className="button primary full opening-finish" onClick={() => {
                if (dispatch({ type: 'opening.finish', day: localDay(), at: now() }))
                    go({ page: 'today' });
            }}>{tr("\u8FDB\u5165\u4ECA\u65E5")}<Icon name="arrow"/></button>
    </section> : <section className="opening-feature">
      <p className="opening-step">{message('app.opening.step', { n: opening.completed + 1, lesson: tr(lessons[opening.completed].title) })}</p>
      <SceneArt id={current.id}/>
      <h2>{localizedTitle(current)}</h2>
      <button className="button primary full opening-start" onClick={() => openScene(current, { opening: true })}>
        {progress ? tr("\u7EE7\u7EED\u8FD9\u4E00\u573A") : tr('开始尝试')}<Icon name="arrow"/>
      </button>
    </section>}
  </div>;
}
export function OpeningDone({ entry, keptWish, favorite, prayer }: {
    entry: CatalogEntry;
    keptWish: boolean;
    favorite?: ReactNode;
    prayer?: ReactNode;
}) {
    const { dispatch, go } = useApp();
    return <div className="opening-complete">
    {keptWish && <p className="quiet">{tr("\u5FC3\u613F\u4E5F\u5DF2\u7559\u5728\u5FC3\u613F\u9875\u3002")}</p>}
    <div className="scene-completion-actions">{favorite}<button className="button primary" data-opening-collect onClick={() => {
            if (dispatch({ type: 'opening.collect', sceneId: entry.id, at: now() }))
                go({ page: 'today' });
        }}>{tr("\u6536\u4E0B")}</button>{prayer}</div>
  </div>;
}
