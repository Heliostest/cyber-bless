import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
const root = process.cwd(), report = JSON.parse(await readFile('artifacts/icon-style-rollout/after/objects-390/report.json', 'utf8'));
const entries = report.results, sourceGroups = new Map(), updated = [];
const section = '## 2026-11-05 小物图标风格正式显示';
const insert = (text, addition) => {
  if (text.includes(section)) return text;
  const end = text.indexOf('\n'); return end >= 0 ? text.slice(0,end+1) + '\n' + addition + '\n' + text.slice(end+1) : text + '\n\n' + addition;
};
for (const entry of entries) {
  if (!/^[a-z0-9-]+$/.test(entry.id)) throw Error('Invalid scene ID');
  const file = entry.id === 'woodfish' ? 'assets/woodfish/README.md' : `packages/scenes/src/${entry.id}/README.md`;
  const link = entry.id === 'woodfish' ? '../../docs/research/2026-11-05-icon-style-rollout.md' : '../../../../docs/research/2026-11-05-icon-style-rollout.md';
  const text = existsSync(file) ? await readFile(file,'utf8') : `# ${entry.title} · ${entry.id}\n`;
  const shape = entry.id === 'omamori-cycle' ? '原封闭袋体增加小幅鼓起，原花叶、缝线与绳结相应贴合；不新增部件或内部内容。' : '器形、部件、原创图案和动作不变。';
  const note = `${section}\n\n默认柔和风格现使用连续明暗、减弱描边与柔和阴影，并参照本场图标在原色系内限幅校准明度/饱和度；保留既有材料、贴图、透光/反射及动态反馈。${shape}这些是产品美术参数，不增加传统材料工艺、寓意、规则或功效主张。来源绑定、标题、引擎版本及存档保持；文化外链未重新访问，沿用既有逐场核查支持范围和读取状态。[实际呈现、边界与验证](${link})。较早试做记录为其当时状态，本轮已正式接入。\n`;
  await writeFile(file,insert(text,note)); updated.push(file);
  if (entry.source && entry.source !== 'product-original') {
    if (!/^[a-z0-9-]+$/.test(entry.source)) throw Error('Invalid source slug');
    const ids = sourceGroups.get(entry.source) ?? []; ids.push(entry.id); sourceGroups.set(entry.source,ids);
  }
}
for (const [slug, ids] of sourceGroups) {
  const file = `content/traditions/${slug}.md`;
  if (!existsSync(file)) throw Error(`Missing existing card: ${file}`);
  const text = await readFile(file,'utf8');
  const note = `${section}\n\n关联场景（${ids.map(id=>'`'+id+'`').join('、')}）已接入图标参照的柔和显示：连续明暗、低强度描边/阴影、原色系内轻调配色，既有材料与文化说明保持。图标及程序表面只作产品美术参照，不是传统材料、工艺、纹样或信仰的证据；本轮未重新访问文化外链，沿用本卡原有支持范围和读取状态。各场实际变化、守袋体积例外与技术验证见[集中记录](../../docs/research/2026-11-05-icon-style-rollout.md)。\n`;
  await writeFile(file,insert(text,note)); updated.push(file);
}
const special = new Set(['woodfish','omamori-cycle','shrine-suzu-bell','furin-wind-chime']);
const inventory = entries.map(entry => ({ id:entry.id,title:entry.title,visible:entry.visible,source:entry.source ?? null,
  observedExistingMaterials:Object.keys(entry.kinds ?? {}),scope:special.has(entry.id)?'shared-rendering-and-approved-object-calibration':'shared-rendering-only',
  culturalClaimsChanged:false,externalSourcesRevisited:false,readme:entry.id==='woodfish'?'assets/woodfish/README.md':`packages/scenes/src/${entry.id}/README.md` }));
await mkdir('docs/research',{recursive:true});
await writeFile('docs/research/2026-11-05-icon-style-coverage.json',JSON.stringify({date:'2026-11-05',visible:entries.filter(e=>e.visible).length,retained:entries.filter(e=>!e.visible).length,entries:inventory,updatedDocumentation:updated},null,2)+'\n');
const rows=inventory.map(entry=>`| [${entry.title} / ${entry.id}](../../${entry.readme}) | ${entry.visible?'当前目录':'历史保留'} | ${entry.observedExistingMaterials.join('、')||'沿用未指定基材表面'} | ${entry.source?'['+entry.source+'](../../content/traditions/'+entry.source+'.md)':'无传统绑定（现状）'} |`).join('\n');
const document=`# 小物向各自图标风格靠拢\n\n核查日期：2026-11-05。用户认可四件可操作样例后，明确授权继续改进各个小物。本轮正式接入默认 \`toon-soft\`（保留原技术 ID），覆盖当前目录91项与历史保留67项。\n\n## 实际呈现、来源支持范围与边界\n\n先查看各图标和实际新旧场景画面，再调整显示。图标由产品生成，不能证明传统。通用变化是连续明暗、低强度描边、柔和阴影，以及从对应图标提取色彩锚点后在**原色相不变**的前提下有限幅调明度/饱和度。黑白、低色度、贴图、顶点色及环境不自动参与调色；文字、符号、步骤、数量、信仰解释不变。\n\n既有材料身份由实际实现中的 craft/optics 与原材质声明决定，不从图标颜色推定木种、陶釉、织法或合金。没有新增起源、资格、期限、数量或功效主张。沿用[首批材质记录](2026-11-05-craft-materials.md)、[91场材料逐项记录](2026-11-05-craft-material-rollout.md)、[全场文化核查](2026-10-19-scene-culture-audit.md)及各场 README/来源卡的支持范围。\n\n本次实际阅读了现行规范、共享渲染代码、四件校准实现与相关本地来源正文、既有材料逐场核查，并逐场查看158项实际渲染的覆盖回执及当前91项图像总览。未重新访问文化外链，未通读全部历史卡文化正文；不能将此次材质测试或文档同步视为重新核验外部文化事实。未变的文化主张沿用原记录，保持其有限支持范围、已知缺口及访问状态。\n\n### 四件明确校准\n\n- 御守：源珊瑚/绿/蓝布色向已选图标靠近；封闭袋体轻微鼓起，原装饰和绳结贴合其表面。保持闭合、部件及原创纹样，不增加内部符札或新织法主张。对应[来源卡](../../content/traditions/omamori-cycle.md)和[四件核查](2026-11-05-icon-look-preview.md)。\n- 木鱼：真实打包 GLB 的温润木色、源法线/AO和开口深度；不按图标新增垫子、刻字或其他部件。宿主仍使用原来源绑定，器物研究见[木鱼卡](../../content/traditions/mokugyo-wooden-fish.md)，不把交互敲击等同课诵或功德。\n- 参拜铃：既有金属色和宽高光校准；裂口、铃眼、木架、三股粗绳与礼敬背景保持。不依据缩略图换成风铃细绳或增加合金/镀金主张。\n- 玻璃风铃：原玻璃透射/反射和粉色纸条校准，柔和的掠射角边缘帮助识别薄玻璃；这是产品着色处理，不是新工艺或真实光学模拟保证。不复制图标花纹，保留原装饰环、舌、纸条部件与夏日宗教/工艺说明。\n\n## 实现、状态与资源\n\n- 共用材质适配器仅在 soft 使用 Standard/Physical 连续明暗；保留原图、墨线和其他预设原有规则。每帧从当下源色计算轻调，不冻结完成色、发光或透明动画。环境树木、用户环境 tone 与纸布/水等既有光学仍有各自处理。\n- 色彩数据由 \`scripts/prepare-icon-style-palettes.mjs\` 从158张现有透明图标确定性提取，排除透明边缘、极亮/极暗和低色度像素。源图哈希与七页图标/色彩预览在 artifacts 中。运行时只微调相近色系的 s/l，不移植新的色相含义。\n- 材质数组成员、hint、编译特征和源 version 变化使缓存按需失效；贴图引用、法线强度、AO、粗糙度、反射/透射、清漆及衰减值保持实时。透明 Physical 玻璃单独受控克隆，普通水、烟、粒子继续走既有路径。中途失败释放半成品并恢复源材质。\n- soft 只暂时缓和定向光与阴影，保留夜色、色温、点光/火焰、用户既有环境调色；正常与异常路径恢复状态。复用现有 HDR 和 composer，不增加独立循环、反射场景或渲染目标。\n- 守袋几何只在创建时鼓起一次；试做适配器识别正式几何，避免重复鼓起。源物件、派生材质与贴图所有权分别保留。\n- 来源 slug、宿主目录、注册表、模块 metadata、技术 ID、引擎版本、原生标题、存档及完成规则均未变化；README和已有来源卡同步本次产品显示范围。\n\n## 验证与查看\n\n真实基线和新渲染均由同一实际场景入口独立打包后在本地 Chromium/SwiftShader 读取；不启动HTTP服务，不访问外部站点。小物隔离视角用于本轮前后对照；代表完整场景另作兼容检查，工作区同时存在的环境美术工作可能体现在完整场景图中，不将其归作本轮小物变化。桌面结果不等同手机 GPU 测速或真机 WebView 验收。\n\n- 全158项新旧实际截图；新效果逐项切换 original/ink/soft，源材质精确恢复，退出后无活动 WebGL context。\n- 当前91项320px逐场渲染，16项完整场景前后检查，12项暗光/夜景检查；均无黑帧、页面/console/shader错误。\n- 最终玻璃边缘补查、实际交互、完整测试和构建结果在完成后补充。\n\n[可搜索前后对照](../../artifacts/icon-style-rollout/index.html)包含全部158件，默认显示当前91件；每张可放大。技术回执、旧新打包与逐场图在 \`artifacts/icon-style-rollout/\`。本清单是实际显示/实现范围，不能替代独立文化证据。\n\n## 逐场范围\n\n| 场景 | 范围 | 实现已声明的材料类别（不是新增鉴定） | 原来源绑定 |\n| --- | --- | --- | --- |\n${rows}\n\n## 规范核查\n\n- [x] 实际器物/材料/动作与完成条件已对照，变化明确归于产品美术；无从图标反推传统。\n- [x] 无新增文化身份、工艺、寓意、规则或功效；继承证据支持范围与本轮外链访问状态如实记录。\n- [x] 无换卡或地区索引式绑定，真实宗教背景保持，未改写为装饰/自省。\n- [x] README/源卡同步产品范围；宿主、注册表、metadata、标题、ID与存档未变。\n- [ ] 最终技术测试、构建、实际画面和交互完成；与文化支持范围审阅分别报告。\n`;
await writeFile('docs/research/2026-11-05-icon-style-rollout.md',document.replaceAll('\`','`'));
console.log(`Documented ${entries.length} scenes, ${sourceGroups.size} existing source cards; no source identity or cultural facts changed.`);
