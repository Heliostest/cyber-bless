# Toon Cloud 远景移植与来源影响核查

后续范围：按用户追加要求，已从本记录的首批三场扩展到 85 个 App 可见白天场景；[完整适用范围与逐场核查](2026-11-04-toon-cloud-daylight-expansion.md)。本记录保留首次移植和技术作品许可的读取事实。

核查日期：2026-11-04（Asia/Shanghai）。

场景：`japanese-koinobori`、`tibetan-prayer-flags`、`tanzaku-tanabata`。

## 实际变更和文化边界

已检查三个场景的实现与 README。布鲤及升挂绳组、五色咒语旗及木支点、短册及竹枝的器形、材料、原有动作、对象、完成条件、标题、介绍与提示均不修改。新增的是远景六层程序化云，使用低饱和淡蓝至白色与缓慢漂移；它属于产品的户外布景，不表示任何特定文化的云纹、圣山、圣境、节期天气或祈愿功效。没有新增文化事实或把渲染效果当成传统证据。

既有核查沿用 [鲤旗 README](../../packages/scenes/src/japanese-koinobori/README.md)、[经幡 README](../../packages/scenes/src/tibetan-prayer-flags/README.md)、[短册 README](../../packages/scenes/src/tanzaku-tanabata/README.md)及其中所链的已读来源和产品简化记录。本次未将这些外部文化材料登记为重新读过。真实信仰与节庆背景保持其原有表述。

来源分类分别保持 `japanese-koinobori`、`tibetan-prayer-flags`、`tanzaku-tanabata`。核对宿主 `daily-scenes.ts`、注册表和模块 metadata 的现有绑定，无需改变来源或技术 ID、引擎和存档。云层的局部产品创作不导致整个场景改为 `product-original`。纸风车及纸鸢处于 App 隐藏列表，本轮不接入，也不改变该列表。

## 技术作品来源与读取状态

| 来源 | 实际读取范围与状态 | 支持范围及边界 |
| --- | --- | --- |
| 本机 Shader Gallery `toon-cloud-material.js`、`toon-cloud-scene.js`、`three-toon-cloud/ATTRIBUTION.md`，原始存档 `Toon Cloud/image.glsl` | 2026-11-04 已读相关代码、作者注释、许可和适配说明 | 圆盘云轮廓、六透明层、层速及署名依据；不支持文化主张 |
| [Creative Commons 官方 CC BY-NC-SA 4.0 摘要](https://creativecommons.org/licenses/by-nc-sa/4.0/) | 2026-11-04 已读许可条件相关正文 | 署名、非商业、相同方式共享与修改说明；不是额外商业授权 |
| [Antoine Clappier / Toon Cloud](https://www.shadertoy.com/view/4t23RR) | 2026-11-04 抓取返回 HTTP 402，未读正文 | 保留原始链接；不把页面登记为已读，移植依据本地存档及其许可注释 |

完整署名、许可及修改说明见 [toon-cloud-ATTRIBUTION.md](../../packages/scene-runtime/src/toon-cloud-ATTRIBUTION.md)。该组件保持 CC BY-NC-SA 4.0，不按项目其他内容的一般许可重新授权。

随包署名：源模块保留压缩器识别的 `@license` 注释；同样的作者、原作与许可链接及修改说明加入 `assets/environments/LICENSE.txt`，沿现有资源准备链复制到 Web/Expo 的 public 和清单。不能只把仓库 Markdown 当作发行署名。2026-11-04 开发者明确说明这是其第一个公开发布的 App，决定永久免费、没有付费解锁。`store/ios/content-rights.json` 的旧付费计划据此更新；该说明不改变云组件的原有非商业许可。App Store 的历史声明字段不随本地渲染更新提交或自行改判。

## 实现与交付核查

- 六个远景平面使用天空深度，避免原有短远裁面截云；常规深度测试使草地、树木与主体遮住云。云材质不受雾、阴影和主体材质转换影响，不参与交互射线。
- 环境时钟控制云、草和树。暂停不推进；减少动态静止；预览和截图不推进云时间。各次挂载独立拥有 GPU 资源并幂等释放。
- 三场 README、来源卡的产品呈现补充技术更新；宿主目录、注册表和 metadata 的标题与来源保持一致；更新场景测试指纹以避免沿用旧测试状态。
- 验证结果与截图在 `artifacts/toon-cloud/`；最终测试数量与浏览器范围在交付后记录于下方。

来源规范清单：实际器物/材料/动作已对照；无新增文化主张、错误地区绑定或规则/寓意外推；原信仰语境不变；传统事实与云布景分别记录；技术身份与来源绑定不变；用户文字不变；技术测试与本次文化影响审阅分开记录。

### 验证结果

- `@wbr/scene-runtime`：14 文件、232 项通过，包含新云层范围、资源释放、预览/暂停/减少动态时钟回归。
- 鲤旗、经幡模块：2 文件、149 项通过；短册相关旧场景、自动收尾、空间放置与注册表：4 文件、575 项通过。
- 内容套件 37 项、App 可见性 7 项、App 资源 7 项、随包资源脚本 3 项均通过。
- `npm run build` 通过；保留项目现有大 chunk 警告。`scene:revisions:check` 通过，158 场指纹对应最终共享依赖。
- 浏览器：三场均完成 390 px 常规动态和 320 px 减少动态的原步骤；18 次 toon-soft/original/gouache 预览生成成功且不推进云时间；页面隐藏/恢复暂停生效，减少动态云时间为零；六次退出各释放 1 个几何和 6 个材质，无页面或控制台错误。这里使用页面可见性事件模拟，非真机验收。
- 另留三场 390×844、1280×900 最终构图截图及禁用云的对照图。最终低云位在草地树线后方保留蓝天留白。
- 产物检查：压缩 JS 中含 Antoine Clappier、原作 URL、原许可链接和修改说明；Web dist、Web public、Expo public 的 `environments/LICENSE.txt` 均含同样通知。本轮没有进行 iOS/Android 原生构建或正式发布。
