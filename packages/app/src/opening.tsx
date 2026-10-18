import { useEffect } from 'react';
import { chooseOpeningScenes, localDay } from '@wbr/core';
import type { CatalogEntry } from '@wbr/content/catalog';
import { builtInScenes, useOpenScene } from './scene-library';
import { SceneArt, SceneBadge } from './scene-icons';
import { Icon } from './art';
import { now, useApp } from './context';
import { PageHead } from './page-heading';

const lessons = [
  { title: '跟着提示动一动', copy: '跟随白色光点和箭头操作，也可以点右下角的辅助。', guide: '跟随白点和箭头操作，也可以点右下角的辅助。' },
  { title: '把小物收进小天地', copy: '完成后收下小物，就能在小天地回看。喜欢的仪式，还可以点爱心标记。', guide: '完成后收下小物。点爱心，可以标记喜欢的仪式。' },
  { title: '为自己留个心愿', copy: '这一场是祈愿仪式。心愿文字可以留，也可以不写；收下的小物还能在心愿页用于祈愿。', guide: '心愿文字可选。收下的祈愿小物，也能在心愿页使用。' },
];

export function Opening() {
  const { state, dispatch, go } = useApp();
  const opening = state.opening;
  const openScene = useOpenScene();
  useEffect(() => {
    if (opening?.status === 'new') dispatch({ type: 'opening.start', sceneIds: chooseOpeningScenes(builtInScenes) });
  }, [opening?.status]);
  if (!opening || opening.status === 'complete') return null;
  if (opening.status === 'new') return <p role="status">正在准备三场小仪式…</p>;
  const entries = opening.sceneIds.map(id => builtInScenes.find(e => e.id === id)!);
  const done = opening.completed === 3;
  const current = entries[opening.completed];
  const progress = state.sceneRecords.find(r => r.id === current?.id)?.progress ?? 0;
  return <div className="opening-page">
    <PageHead title={done ? '小天地准备好了' : '初次见面'} eyebrow={done ? '这三场已留好，想玩时随时回来。' : '三场小仪式，开启你的小天地。'} />
    {!done && <ol className="opening-track" aria-label="开场进度">
      {entries.map((entry, index) => <li key={entry.id} aria-current={index === opening.completed ? 'step' : undefined} data-complete={index < opening.completed}>
        <SceneBadge id={entry.id} />
        <span className="opening-step-mark">{index < opening.completed ? <Icon name="check" /> : index + 1}</span>
        <small>{index === 2 ? '祈愿' : '祈福'}</small>
      </li>)}
    </ol>}
    {done ? <section className="opening-summary">
      <div className="opening-keepsakes">
        {entries.map(entry => <div key={entry.id}><SceneArt id={entry.id} /><strong>{entry.title}</strong><small>已收进小天地</small></div>)}
      </div>
      <p>首页可以再走这三场，也有一场新的今日仪式。</p>
      <button className="button primary full opening-finish" onClick={() => {
        if (dispatch({ type: 'opening.finish', day: localDay(), at: now() })) go({ page: 'today' });
      }}>进入今日<Icon name="arrow" /></button>
    </section> : <section className="opening-feature">
      <p className="opening-step">第 {opening.completed + 1} 场 · {lessons[opening.completed].title}</p>
      <SceneArt id={current.id} />
      <h2>{current.title}</h2>
      <p className="opening-copy">{opening.completed === 0 && current.engine === 'woodfish@1'
        ? '轻敲木鱼，跟着回响慢慢来。完成后收下这份小物。'
        : lessons[opening.completed].copy}</p>
      <button className="button primary full opening-start" onClick={() => openScene(current, { opening: true })}>
        {progress ? '继续这一场' : '开始这一场'}<Icon name="arrow" />
      </button>
    </section>}
  </div>;
}

/** A short note outside the canvas; the scene's own cues still teach the gesture. */
export function OpeningGuide({ sceneId }: { sceneId: string }) {
  const { state } = useApp();
  const opening = state.opening;
  if (opening?.status !== 'active') return null;
  const index = opening.sceneIds.indexOf(sceneId);
  if (index < 0) return null;
  return <aside className="opening-guide" data-step={index + 1} aria-label={`开场第 ${index + 1} 场`}>
    <span>初见 {index + 1} / 3</span><p>{index === 0 && sceneId === 'woodfish'
      ? '轻敲木鱼，听听回响；右上角可开关声音。'
      : lessons[index].guide}</p>
  </aside>;
}

export function OpeningDone({ entry, keptWish }: { entry: CatalogEntry; keptWish: boolean }) {
  const { dispatch, go } = useApp();
  return <div className="opening-complete">
    <p className="scene-done">这场完成了，把小物收好。</p>
    <div className="opening-reward"><SceneArt id={entry.id} /></div>
    {keptWish && <p className="quiet">心愿也已留在心愿页。</p>}
    <button className="button primary" data-opening-collect onClick={() => {
      if (dispatch({ type: 'opening.collect', sceneId: entry.id, at: now() })) go({ page: 'today' });
    }}>收下，继续<Icon name="arrow" /></button>
  </div>;
}
