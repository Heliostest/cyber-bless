import { useEffect, useMemo, useState } from 'react';
import { BlessingApp } from '@wbr/app';
import { createState } from '@wbr/core';
import { builtInScenes } from '@wbr/core/daily-scenes';
import { browserHost } from '@wbr/runtime';
import './scene-review.css';

function indexFromURL() {
  const id = new URLSearchParams(window.location.search).get('scene');
  return Math.max(0, builtInScenes.findIndex(entry => entry.id === id));
}

export default function SceneReview() {
  const [index, setIndex] = useState(indexFromURL);
  const [attempt, setAttempt] = useState(0);
  const entry = builtInScenes[index];
  // Every selection mounts the actual App against a fresh in-memory save.
  const host = useMemo(() => {
    let raw = JSON.stringify(createState());
    return {
      read: async () => raw,
      write: async (next: string) => { raw = next; },
      haptic: browserHost().haptic,
    };
  }, [index, attempt]);

  useEffect(() => {
    const onPopState = () => { setIndex(indexFromURL()); setAttempt(n => n + 1); };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  function select(next: number) {
    if (next < 0 || next >= builtInScenes.length) return;
    const url = new URL(window.location.href);
    url.searchParams.set('scene', builtInScenes[next].id);
    window.history.pushState(null, '', url);
    setIndex(next);
    setAttempt(n => n + 1);
  }

  return <div className="scene-review">
    <header className="scene-review-header">
      <div className="scene-review-heading">
        <strong>Three.js 场景手动检查</strong>
        <span role="status">{index + 1} / {builtInScenes.length} · {entry.title}</span>
        <a href="/">回到 App</a>
      </div>
      <nav className="scene-review-controls" aria-label="场景遍历">
        <button type="button" disabled={index === 0} onClick={() => select(0)}>第一个</button>
        <button type="button" disabled={index === 0} onClick={() => select(index - 1)}>上一个</button>
        <select aria-label="跳转场景" value={entry.id}
          onChange={event => select(builtInScenes.findIndex(scene => scene.id === event.target.value))}>
          {builtInScenes.map((scene, n) => <option key={scene.id} value={scene.id}>
            {String(n + 1).padStart(2, '0')} · {scene.title}
          </option>)}
        </select>
        <button type="button" disabled={index === builtInScenes.length - 1} onClick={() => select(index + 1)}>下一个</button>
        <button type="button" disabled={index === builtInScenes.length - 1} onClick={() => select(builtInScenes.length - 1)}>最后一个</button>
        <button type="button" onClick={() => setAttempt(n => n + 1)}>重新开始</button>
      </nav>
      <p><code>{entry.id}</code><span>每次切换从头体验 · 独立测试记录</span></p>
    </header>
    <BlessingApp key={`${entry.id}:${attempt}`} host={host}
      initialRoute={{ page: 'scene', id: entry.id, entry, replay: true }} />
  </div>;
}
