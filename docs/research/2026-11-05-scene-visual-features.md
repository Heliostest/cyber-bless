# 场景列表视觉要素标注

核查日期：2026-11-05。本次为场景检查页、旧场景廊和「我的 → 场景目录」增加共享的图标与短标签。目录搜索同时匹配当前语言的标签；图例说明默认布景、互动后出现的要素及临时调试覆盖的边界。

## 标注依据与范围

- 日／夜、暖光、无环境树的海岸例外：直接读取共享环境的 `environment-profiles.ts`。该表从 `cozy-environment.ts` 原样迁出，渲染器与列表共用，数值和场景分支没有变化。
- 主辅光：已核对程序化场景的 `addStageLights` / `addCelLights` 和木鱼灯光。点光仅列出 `scene.ts` / `model.ts` 实际创建 `PointLight` 的 13 场，含随互动点亮的灯。
- 水体：复核 [15 场水体盘点](2026-11-04-toon-water.md) 对应的 `scene.ts` / `model.ts`、`stylized-water.ts` 和 `ritual-optics.ts`。酒液、浮彩承载液、茶汤与蜂蜜显示「其他液体」，地图蓝线不记水体。
- 透明：水体、实际使用 transmission 的玻璃／茶汤／蜂蜜、酒液及薄膜；隐形拾取辅助体、接触阴影、提示线和光晕不计入。浮彩承载面没有因为通用 `kind: water` 就记为透明清水；烟雾独立标注。
- 玻璃：`furin-wind-chime`、`venetian-glass-bead`、`turkish-nazar-bead` 实际的透射材质。`czech-bead-star` 当前呈现为金属／不透明珠面，不因标题或传统器物材料就标为透明玻璃。
- 火焰：油灯、叶舟、初访壁炉、花环篝火和奉献蜡烛。烟雾：`chinese-incense`、`persian-esfand` 的可见烟网格。
- 环境树：调用实际默认的 `getSceneTreeRecommendation`，沿用 [默认布景核查](2026-11-05-environment-defaults.md) 与[地区树形证据边界](2026-11-05-regional-tree-evidence.md)。九个特色树映射保持；其余日景为 KayKit 阔叶树，夜景为原有阔叶／针叶混合造型。`udo-undama` 无环境树，不添加树标签。
- 主题植物：已读 `tanzaku-tanabata/scene.ts`、`japanese-kadomatsu/model.ts`、`sri-lankan-bodhi-puja/model.ts`、`lam-tsuen-wishing-tree/model.ts`，仅标已有竹叶／竹枝、菩提主题树和许愿主题树。竹制器物不因此被标为场景中有活竹林。

标签描述正式默认与互动阶段可能出现的视觉内容。临时树木／配色／水纹调试选择、失败回退后的实时状态继续由现有调试控件报告，不改写目录。标签模块不加载 Three.js、场景引擎或模型。

## 文化影响与来源状态

已阅读[现行核查规范](../scene-provenance.md)。本次只增加列表展示和搜索；不改变器物、材料身份、动作、完成条件、对象、场合、标题、介绍、提示、结束语、寓意、来源字段或分类。树型是当前产品美术造型的描述，不是地域、传统必备植物或功效主张。

文化事实和产品简化沿用上引既有核查及各场景 README / 来源卡；本次读取本地实现和既有核查，没有将外部文献登记为重新读过。来源卡、场景 README、宿主条目、注册表、模块 metadata、原生标题、技术 ID、引擎与存档均无需文化字段更新。

## 交付核查

- [x] 已逐项核对实际呈现；没有用标题、地区或代码证明新增文化事实。
- [x] 没有新增文化主张、传统寓意、动作规则或来源绑定。
- [x] 透明辅助网格、非清水液体和无环境树场景有明确排除。
- [x] 来源身份、介绍和互动保持，技术 ID 与存档兼容。
- [x] 相关测试、构建和桌面／手机显示验证已完成，结果如下。

## 技术验证

- 场景视觉清单、共享环境与默认环境测试 113 项通过；App 目录、状态、树木／水体调试与导航相关测试 25 项通过。
- `npm run build -w @wbr/cyber-bless` 通过（包含 TypeScript 与 Vite），保留已有体积提示；八语言 `i18n:check` 与编译一致性检查通过。
- `node scripts/verify-scene-visual-features.mjs --serve`：实际浏览器检查 158 个调试页选项与 91 个可见目录场景，验证水体／樱花／夜景搜索、图例、桌面与 390×844 窄屏布局；无横向溢出、页面异常。截图与报告在 `artifacts/scene-visual-features/`。Windows 本地 Playwright 缓存可通过 `PLAYWRIGHT_BROWSERS_PATH` 指定。
- `node scripts/scene-testing-revisions.mjs --check`：158 场修订指纹一致；共享配置迁出后已同步生成指纹，技术 ID／引擎版本不变。
- 完整 `npm run i18n:verify` 仍被原工作区 `apps/cyber-bless/src/icon-look-preview.ts` 的 11 处提取问题阻断。本次新增标签没有新增提取问题；未在本任务中修改该既有预览页面。

上述检查证明显示和实现一致，不替代文化来源审阅；本次文化影响仅为前述无新增文化主张的列表显示变更。

## 2026-11-05 提交整合

按用户授权，以 master 的 `7ece5439` 为基线建立独立检出，仅提取本次视觉标签、目录搜索、共享环境配置迁出及对应翻译／测试／文档。没有带入原工作区另一组树形预览改动。共享生成文件在独立版本重新生成，并保留原审阅记录中的证据条目。

独立检出先按提交中的 SHA-256 核对并补齐 2,141 个 Git LFS 实体，不使用指针替代模型或图片。最终完整 `npm test` 与 `npm run build` 均退出 0，包含完整 i18n 校验；前述旧预览文件的提取问题仅属于原开发工作区，本次独立提交不含该文件。实际浏览器再次检查 158 个选项、91 个目录条目、标签搜索、图例及桌面／390px 手机显示，无页面错误或横向溢出。日志和截图保存于本检出的 `artifacts/scene-visual-integration/` 与 `artifacts/scene-visual-features/`。

提交前 master 已推进至 8ca61f00（树木预览）。本次同步该基线后，再次通过 App 与渲染运行时全套测试、场景类型检查、离线资源脚本、完整构建及场景修订一致性检查，保留双方功能。
