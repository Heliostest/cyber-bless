import { createOmamoriCycle } from '../packages/scenes/src/omamori-cycle/scene';
import { createShrineSuzuBell } from '../packages/scenes/src/shrine-suzu-bell/scene';
import { createFurinWindChime } from '../packages/scenes/src/furin-wind-chime/scene';
import * as shared from '@wbr/shared';
import * as gestures from '@wbr/gestures';
import type { SceneInstance } from '../packages/scenes/src/contract';
import { createWoodfishScene } from '../packages/app/src/woodfish-scene';
import { woodfishContent } from '../packages/app/src/content';
import type { WoodfishController } from '../packages/app/src/scene-engines';
import './icon-look-preview.css';

const subjects = [
  { id: 'omamori-cycle', title: '御守', material: '织物与绳结', detail: '珊瑚色、细织纹、柔和的袋体明暗。', action: '选一只小袋，再把绳环拖向旅行包的扣环。' },
  { id: 'woodfish', title: '木鱼', material: '温润木质', detail: '蜂蜜木色、细木纹、连续曲面高光。', action: '轻点木鱼，观看木槌落下与回弹。' },
  { id: 'shrine-suzu-bell', title: '金属铃', material: '金属与编绳', detail: '温暖金色、宽柔反光、保留暗部的深度。', action: '按住粗铃绳向下拉，再松手听铃。' },
  { id: 'furin-wind-chime', title: '玻璃风铃', material: '玻璃与薄纸', detail: '浅蓝通透、柔亮边缘、清楚可见的铃舌。', action: '轻点玻璃铃身，或向上轻拂纸条。' },
];
const sceneFactories = { 'omamori-cycle': createOmamoriCycle, 'shrine-suzu-bell': createShrineSuzuBell, 'furin-wind-chime': createFurinWindChime };
function asset(path: string) {
  return (globalThis as typeof globalThis & { __iconLookAssets?: Record<string, string> }).__iconLookAssets?.[path] ?? path;
}
const root = document.querySelector<HTMLElement>('#root')!;
root.innerHTML = `<header><a href="/">← 返回应用</a><span class="eyebrow">VISUAL STUDY / 01</span><h1>把图标里的质感，<br>带进手中的小物。</h1><p>同一件器物、同一个视角，比较颜色、光线和表面的变化。两侧都可以实际操作。</p></header>
<nav aria-label="选择对比器物">${subjects.map((s, i) => `<button type="button" data-subject="${s.id}" aria-pressed="${i === 0}"><img src="${asset(`/scene-icons/soft3d/${s.id}.webp`)}" alt=""/><span>${s.title}<small>${s.material}</small></span></button>`).join('')}</nav>
<section class="study"><div class="study-heading"><div><span class="eyebrow">质感对照</span><h2 id="subject-title"></h2><p id="subject-detail"></p></div><div class="study-controls"><button class="view-toggle" type="button" aria-pressed="true">器物近看</button><button class="reset" type="button">重新体验 ↻</button></div></div>
<div class="comparison"><aside class="reference"><div class="panel-heading"><b>图标参照</b><span>颜色 · 材料 · 柔和感</span></div><div class="reference-image"><img id="reference" alt="当前器物的图标参照"/></div><p id="action"></p></aside>
${['current', 'icon'].map((mode, i) => `<article class="panel ${mode}"><div class="panel-heading"><b>${i ? '调整效果' : '当前效果'}</b><span>${i ? '连续明暗 · 柔光材质' : '现有柔和卡通'}</span></div><div class="stage" data-mode="${mode}" data-icon-look-preview="${mode}"></div><div class="progress" aria-live="polite">正在准备小物…</div></article>`).join('')}</div></section>
<footer>四件样例 · 图标仅用于美术对照 · 此页操作不会写入仪式记录</footer>`;
if (location.protocol === 'file:') { const link = root.querySelector<HTMLAnchorElement>('header>a')!; link.href = '#'; link.textContent = '器物质感样例 / 可操作对照'; }

let generation = 0, selected = subjects[0].id, closeView = true;
let cleanups: (() => void)[] = [];
function clear() { for (const dispose of cleanups.splice(0)) dispose(); }
async function select(id: string) {
  const subject = subjects.find(s => s.id === id); if (!subject) return;
  const ticket = ++generation; selected = id; clear();
  root.dataset.subject = id; root.dataset.ready = 'false';
  delete root.dataset.error;
  document.querySelectorAll<HTMLButtonElement>('button[data-subject]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.subject === id)));
  document.querySelector('#subject-title')!.textContent = `${subject.title} / ${subject.material}`;
  document.querySelector('#subject-detail')!.textContent = subject.detail;
  document.querySelector('#action')!.textContent = subject.action;
  document.querySelector<HTMLImageElement>('#reference')!.src = asset(`/scene-icons/soft3d/${id}.webp`);
  let ready = 0;
  for (const host of document.querySelectorAll<HTMLDivElement>('.stage')) {
    if (closeView) host.dataset.scenePresentation = 'object'; else delete host.dataset.scenePresentation;
    host.dataset.iconLookFocus = String(closeView);
    host.dataset.iconLookCues = 'hidden';
    host.replaceChildren(); host.dataset.progress = '0';
    const status = host.nextElementSibling as HTMLElement;
    status.textContent = '正在准备小物…';
    const markReady = () => { if (ticket !== generation) return; status.textContent = '可以直接操作上方小物'; if (++ready === 2) root.dataset.ready = 'true'; };
    if (id === 'woodfish') {
      const cancellation = new AbortController();
      let controller: WoodfishController;
      controller = createWoodfishScene(host, { sceneId: id, active: true, reducedMotion: false, signal: cancellation.signal,
        content: woodfishContent({}), decodeSound: async () => { throw Error('The comparison host does not request sound'); },
        onInstruction() {}, impact() { host.dataset.progress = String(Number(host.dataset.progress) + 1); status.textContent = `已轻敲 ${host.dataset.progress} 下`; },
        ready: markReady, failed(error) { if (ticket !== generation) return; status.textContent = `加载失败：${String(error)}`; root.dataset.error = String(error); },
      });
      const hit = document.createElement('button'); hit.className = 'woodfish-hit'; hit.type = 'button'; hit.setAttribute('aria-label', '轻点木鱼');
      hit.addEventListener('click', () => controller.strike()); host.append(hit);
      cleanups.push(() => { cancellation.abort(); controller.dispose(); });
      continue;
    }
    const create = sceneFactories[id as keyof typeof sceneFactories]; if (ticket !== generation) return;
    const canvas = document.createElement('canvas'), overlay = document.createElement('div');
    overlay.className = 'preview-overlay'; host.append(canvas, overlay);
    let alive = true, frame = 0, last = 0;
    const instance: SceneInstance = create({ canvas, overlay, shared, gestures, sceneId: id, stage: 'day',
      isActive: () => alive && !document.hidden, isReducedMotion: () => false, isSoundEnabled: () => false, deferWishWriting: true,
      onProgress(value) { host.dataset.progress = String(value); status.textContent = value >= 3 ? '这一刻已经完成 · 可重新体验' : `已完成 ${value} 步`; },
    });
    const tick = (now: number) => { if (!alive) return; instance.update(last ? Math.min((now - last) / 1000, .05) : 0); last = now; frame = requestAnimationFrame(tick); };
    cleanups.push(() => { alive = false; cancelAnimationFrame(frame); instance.dispose(); });
    instance.start(); frame = requestAnimationFrame(tick); markReady();
  }
}
root.querySelectorAll<HTMLButtonElement>('[data-subject]').forEach(button => button.addEventListener('click', () => { void select(button.dataset.subject!); }));
root.querySelector('.reset')!.addEventListener('click', () => { void select(selected); });
root.querySelector('.view-toggle')!.addEventListener('click', event => {
  closeView = !closeView; const button = event.currentTarget as HTMLButtonElement;
  button.textContent = closeView ? '器物近看' : '完整场景'; button.setAttribute('aria-pressed', String(closeView)); void select(selected);
});
window.addEventListener('pagehide', clear);
const initial = new URLSearchParams(location.search).get('subject');
void select(subjects.some(s => s.id === initial) ? initial! : selected);
