// Validate persisted browser evidence and build the complete per-scene matrix.
// node --experimental-strip-types scripts/summarize-scene-stage-audit.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { builtInScenes, isSceneVisibleInApp } from '../packages/core/src/daily-scenes.ts';
import { sceneIntention } from '../packages/core/src/scene-intentions.ts';

const directory = resolve(process.argv.slice(2).find(arg => !arg.startsWith('--')) || 'artifacts/all-scene-stability');
const readJson = async path => JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''));
const hash = async path => createHash('sha256').update(await readFile(path)).digest('hex').toUpperCase();
const manifest = await readJson(resolve(directory, 'source-manifest.json'));
const sourceChanges = [];
for (const source of manifest.sources) if (await hash(resolve(source.path)) !== source.sha256) sourceChanges.push(source.path);
if (await hash('scripts/scene-stage-audit-browser.mjs') !== manifest.runner) sourceChanges.push('scripts/scene-stage-audit-browser.mjs');
if (manifest.previousRunner && await hash(manifest.previousRunner.path) !== manifest.previousRunner.sha256) sourceChanges.push(manifest.previousRunner.path);
const dimensions = { short: [320, 568], phone: [390, 844], desktop: [1191, 1244] };
const aggregationErrors = [];
if (process.argv.includes('--shards') || process.argv.includes('--frozen-shards')) {
  for (const name of Object.keys(dimensions)) {
    const suffixes = process.argv.includes('--frozen-shards') ? ['a', 'b', 'c'] : ['prefix', 'a', 'b'];
    const segments = await Promise.all(suffixes.map(suffix => readJson(resolve(directory, `${name}-${suffix}.json`))));
    const interrupted = segments.flatMap(segment => segment.results.filter(result => result.failure?.message === 'Audit cancelled'));
    let results = segments.flatMap(segment => segment.results.filter(result => result.failure?.message !== 'Audit cancelled'));
    let retry;
    if (process.argv.includes('--retries')) {
      retry = await readJson(resolve(directory, `${name}-retry.json`));
      const failedIds = results.filter(result => result.status === 'fail').map(result => result.id).sort();
      const retriedIds = retry.results.map(result => result.id).sort();
      if (JSON.stringify(failedIds) !== JSON.stringify(retriedIds) || retry.running || retry.fatal || !retry.finishedAt)
        aggregationErrors.push(`${name}: incomplete/incorrect independent retest`);
      results = results.map(result => {
        const retest = retry.results.find(item => item.id === result.id);
        return retest ? { ...retest, previousAttempt: result } : result;
      });
    }
    const merged = {
      ...segments[0], name, total: builtInScenes.length, results,
      running: segments.some(segment => segment.running), fatal: segments.find(segment => segment.fatal)?.fatal || null,
      normalMotion: segments.every(segment => segment.normalMotion),
      finishedAt: [...segments, ...(retry ? [retry] : [])].map(segment => segment.finishedAt).filter(Boolean).sort().at(-1),
      passed: results.filter(result => result.status === 'pass').length,
      failed: results.filter(result => result.status === 'fail').length,
      resumedInterruptedIds: interrupted.map(result => result.id),
      segments: [...segments, ...(retry ? [retry] : [])].map(segment => ({ name: segment.name, version: segment.version, viewport: segment.viewport,
        normalMotion: segment.normalMotion, startedAt: segment.startedAt, finishedAt: segment.finishedAt })),
    };
    await writeFile(resolve(directory, `${name}.json`), `${JSON.stringify(merged, null, 2)}\n`);
  }
}
const reports = await Promise.all(Object.keys(dimensions).map(async name => [name, await readJson(resolve(directory, `${name}.json`))]));
const errors = [...aggregationErrors, ...sourceChanges.map(path => `Source changed during audit: ${path}`)];
let frames = 0, renders = 0, actions = 0, completed = 0, wishFlows = 0, issues = 0, maxAspectError = 0;
const maxDelta = { card: 0, canvas: 0, buffer: 0 };
const crossSceneDelta = {};
const crossScenePositionDelta = {};
for (const [name, report] of reports) {
  const [width, height] = dimensions[name];
  if (report.running || report.fatal || !report.finishedAt) errors.push(`${name}: audit not successfully finished`);
  if (report.viewport.width !== width || report.viewport.height !== height || !report.normalMotion) errors.push(`${name}: incorrect viewport/motion`);
  if (report.segments?.some(segment => segment.viewport.width !== width || segment.viewport.height !== height || !segment.normalMotion)) errors.push(`${name}: inconsistent segment viewport/motion`);
  const ids = report.results.map(result => result.id);
  const reference = report.results.find(result => result.baseline)?.baseline;
  crossSceneDelta[name] = 0;
  crossScenePositionDelta[name] = 0;
  if (new Set(ids).size !== builtInScenes.length || ids.length !== builtInScenes.length || report.total !== builtInScenes.length) errors.push(`${name}: incomplete/duplicate scene coverage`);
  for (const scene of builtInScenes) {
    const result = report.results.find(result => result.id === scene.id);
    if (!result) { errors.push(`${name}/${scene.id}: missing`); continue; }
    if (result.status !== 'pass' || !result.completed || result.issueCount || result.frames < 12 || result.renders < 5)
      errors.push(`${name}/${scene.id}: ${result.failure?.message || 'incomplete evidence'}`);
    if (Math.max(0, ...result.checkpoints.map(checkpoint => checkpoint.value)) < result.steps)
      errors.push(`${name}/${scene.id}: final engine progress was not observed`);
    if (reference && result.baseline) {
      for (const target of ['card', 'canvas']) for (const key of ['width', 'height']) {
        const delta = Math.abs(result.baseline[target][key] - reference[target][key]);
        crossSceneDelta[name] = Math.max(crossSceneDelta[name], delta);
        if (delta > .75) errors.push(`${name}/${scene.id}: inconsistent ${target} ${key} across scenes`);
      }
      for (const target of ['cardOffset', 'canvasOffset']) for (const key of ['x', 'y']) {
        const delta = Math.abs(result.baseline[target][key] - reference[target][key]);
        crossScenePositionDelta[name] = Math.max(crossScenePositionDelta[name], delta);
        if (delta > 1) errors.push(`${name}/${scene.id}: inconsistent ${target} ${key} across scenes`);
      }
    }
    const wishes = !!sceneIntention(scene.id)?.optionalWish;
    if (wishes && !['opened', 'cancelled', 'reopened', 'saved'].every(key => result.wish?.[key])) errors.push(`${name}/${scene.id}: incomplete wish flow`);
    if (!wishes && result.wish?.applicable !== false) errors.push(`${name}/${scene.id}: unexpected wish flow`);
    frames += result.frames; renders += result.renders; actions += result.actions.length;
    completed += Number(result.completed); wishFlows += Number(wishes && result.wish?.saved);
    issues += result.issueCount; maxAspectError = Math.max(maxAspectError, result.maxAspectError);
    for (const target of Object.keys(maxDelta)) maxDelta[target] = Math.max(maxDelta[target], ...Object.values(result.maxDelta[target]));
  }
}
const summary = {
  status: errors.length ? 'fail' : 'pass', generatedAt: new Date().toISOString(),
  frozenRoot: manifest.frozenRoot || null, sourceCapturedAt: manifest.capturedAt,
  scenes: builtInScenes.length, publicScenes: builtInScenes.filter(isSceneVisibleInApp).length,
  cases: reports.reduce((sum, [, report]) => sum + report.results.length, 0), completed,
  retestedCases: reports.reduce((sum, [, report]) => sum + report.results.filter(result => result.previousAttempt).length, 0),
  wishFlows, frames, renders, actions, issues, maxDelta, crossSceneDelta, crossScenePositionDelta, maxAspectError,
  sourceFilesVerified: manifest.sources.length, sourceChanges, errors,
  viewports: Object.fromEntries(reports.map(([name, report]) => [name, {
    ...report.viewport, normalMotion: report.normalMotion, startedAt: report.startedAt,
    finishedAt: report.finishedAt, passed: report.results.filter(result => result.status === 'pass').length,
  }])),
};
await writeFile(resolve(directory, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
const escape = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const rows = builtInScenes.map(scene => {
  const wishes = !!sceneIntention(scene.id)?.optionalWish;
  const cells = reports.map(([name, report]) => {
    const r = report.results.find(result => result.id === scene.id);
    if (!r) return '<td class="fail">缺失</td>';
    const checkpoints = [...new Set(r.checkpoints.map(c => c.value))].join(' → ') || '—';
    const history = r.previousAttempt ? `<p>独立复测记录：首轮 ${escape(r.previousAttempt.failure?.message)}。首轮证据完整保留在原始 JSON 的 previousAttempt 中。</p>` : '';
    return `<td class="${r.status}"><details><summary>${r.status === 'pass' ? '通过' : '失败'}</summary><p>${escape(r.failure?.message || '步骤、完成、收尾动画均已检查')}</p><p>进度：${escape(checkpoints)}<br>操作：${r.actions.length}；布局采样：${r.frames}；相机渲染：${r.renders}<br>窗体 ${r.baseline?.card.width.toFixed(2)} × ${r.baseline?.card.height.toFixed(2)}<br>画布 ${r.baseline?.canvas.width.toFixed(2)} × ${r.baseline?.canvas.height.toFixed(2)}<br>尺寸最大变化 ${Math.max(...Object.values(r.maxDelta).flatMap(Object.values)).toFixed(3)} px</p>${wishes ? '<p>许愿：打开、输入、取消、重新打开、保存</p>' : ''}${history}</details></td>`;
  }).join('');
  return `<tr data-search="${escape(`${scene.title} ${scene.id}`.toLowerCase())}"><th>${escape(scene.title)}<small>${escape(scene.id)}</small></th><td>${isSceneVisibleInApp(scene) ? '公开' : '内部 / 兼容'}</td><td>${wishes ? '已覆盖' : '不适用'}</td>${cells}</tr>`;
}).join('\n');
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>全部仪式窗体与 Three.js 视口验证</title><style>body{margin:0;background:#eef8f4;color:#193c34;font:15px/1.65 system-ui,sans-serif}main{max-width:1160px;margin:auto;padding:32px 20px}h1{font-size:27px;line-height:1.3}p{max-width:85ch}input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #86aa9e;border-radius:10px;font:inherit;background:white}table{width:100%;border-collapse:collapse;background:white;margin-top:20px}th,td{text-align:left;padding:12px;border-bottom:1px solid #d4e5de;vertical-align:top}thead{background:#d1eee2;position:sticky;top:0}small{display:block;font-weight:400;color:#64776e}summary{cursor:pointer;font-weight:650}.pass{color:#136342}.fail{color:#ad3939}details p{font-size:12px}code{background:#e0eee7;padding:1px 4px}.scroll{overflow:auto}a{color:#14654d}</style><main><h1>全部仪式窗体与 Three.js 视口验证</h1><p><strong class="${summary.status}">${summary.status === 'pass' ? '全部通过' : '仍有失败'}：${completed} / ${builtInScenes.length * reports.length} 次完整流程</strong>。${builtInScenes.length} 个仪式（${summary.publicScenes} 个公开、${builtInScenes.length - summary.publicScenes} 个内部或兼容），三种尺寸，${wishFlows} 次许愿流程。</p><p>连续记录 ${frames.toLocaleString()} 个布局采样、${renders.toLocaleString()} 次实际相机渲染。窗体、画布和 WebGL 缓冲区的尺寸最大变化分别为 ${maxDelta.card} / ${maxDelta.canvas} / ${maxDelta.buffer} px。${errors.length ? escape(errors.join('；')) : '没有检测到非预期尺寸或位置跳变。'}</p><p>运行真实 BlessingApp 和引擎，通过实际辅助操作、选项、完成和表单处理器推进；使用独立内存存档，不写玩家数据。所有步骤与四秒收获动画保持正常速度。内部场景由初始路由进入，未修改公开目录。检查世界透视 / 正交相机与实际画布比例；排除屏幕后处理相机和环境立方体贴图。许愿检查包含取消不保存及重开清空草稿。此证据为浏览器模拟尺寸，不等同于 iOS / Android 真机键盘验证。</p><p>原始数据：${reports.map(([name]) => `<a href="${name}.json">${name}.json</a>`).join(' · ')} · <a href="summary.json">汇总 JSON</a>。源码一致性核对 ${manifest.sources.length} 个文件。</p><input id="search" aria-label="搜索仪式" placeholder="按标题或技术 ID 搜索"><div class="scroll"><table><thead><tr><th>仪式</th><th>目录</th><th>许愿</th><th>320 × 568</th><th>390 × 844</th><th>1191 × 1244</th></tr></thead><tbody>${rows}</tbody></table></div><p>生成于 ${escape(summary.generatedAt)}。</p></main><script>document.querySelector('#search').addEventListener('input',e=>{const q=e.target.value.trim().toLowerCase();document.querySelectorAll('tbody tr').forEach(row=>{row.hidden=!row.dataset.search.includes(q)})})</script></html>`;
const snapshotNotice = manifest.frozenRoot ? `<p><strong>本报告验证固定源码快照。</strong>快照时间：${escape(manifest.capturedAt)}。其他窗口在此之后的修改不在本轮结论内。</p>` : '';
await writeFile(resolve(directory, 'report.html'), html.replace('</h1>', `</h1>${snapshotNotice}`));
console.log(JSON.stringify(summary, null, 2));
if (errors.length) process.exitCode = 1;
