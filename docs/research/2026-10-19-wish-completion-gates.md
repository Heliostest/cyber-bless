# 写愿与完成条件核查（2026-10-19）

## 范围与结论

本记录逐一核对 `packages/core/src/daily-scenes.ts` 的 78 项宿主目录及对应实现；其中 77 个模块在 `packages/scenes/src/`，木鱼使用 `packages/app/src/woodfish.tsx` 与宿主敲击进度。按当前 App 可见性：35 项可见、43 项隐藏。核查起点有 35 个模块具有独立的 `createWishWrite` 接口，其中 21 项可见、14 项隐藏；其余 43 项没有场景写愿入口。本轮方巾裹礼单独改为纯物体动作，因此最终是 34 个可选表单模块（20 项可见、14 项隐藏）、44 项无场景写愿入口；下表记录最终状态。

先查实际完成状态、按钮、物体动作与 `saveWish` 调用，再查输入控件与提交回调。未把愿望相关 metadata 或来源卡标题当作输入门槛的证明。结论：

- 35 项可见场景原本均有免书写动作；不必删去点目、悬挂、放置、收结等核心动作。
- 隐藏的 `celtic-folk-spring` 在检查点 2 唯一只开放表单提交。现增加「静看片刻」，保留原来的俯身与放置信物，完成不保存草稿。
- 可见的 `phuang-malai` 与 `milagros` 原本允许不写字完成，但辅助完成按钮会读取已输入、未提交的草稿。现只让明确表单提交传入文字，普通完成动作不读取草稿。
- 除改为纯物体动作的方巾裹礼，其余独立模块的可选表单接口保留。主应用通过 `deferWishWriting` 适配器延后写愿，在完成后提供自愿记录；不以空文本假提交、自动提交或跳过真实物体动作推进进度。
- 本次只调整免输入完成、保存边界与说明。技术 ID、引擎版本、已有进度检查点、来源分类与存档兼容性保持原样。

## 具体缺陷与修复

| 场景 | 修复前的实际条件 | 修复后 |
| --- | --- | --- |
| `celtic-folk-spring`（隐藏） | `wishWrite` 阶段隐藏辅助按钮，`onActionTap` 无终步分支；只有明确提交才能报告进度 3 | 终步显示「静看片刻」，点按报告进度 3 一次；已有独立表单提交仍可用 |
| `phuang-malai`（可见） | `onAction` 读取输入框，再调用 `submitThanks`；放置动作会保存未提交草稿 | `onAction` 只完成花环放置／致谢，不传入草稿；明确表单提交仍可保存一次 |
| `milagros`（可见） | `action` 在终步把输入框当前值传给 `finish` | `action` 调用无文本 `finish()`；明确表单提交仍可保存一次 |

这些是输入与持久化缺陷。对核查起点没有文字入口的 43 项，核对其实现未创建输入框、未调用写愿接口，也未在完成时读取文字，因此没有需要替代的书写门槛。方巾裹礼的纯物体动作改造由该场景的实现与测试另行验证。

## 全部 78 项逐项结果

“表单”表示独立模块支持可选表单，并不表示 App 在体验过程中显示它。“已有免输入”表示按原来的物体动作或辅助按钮继续，非空提交只是另一条可选路径。

| 场景 ID | App | 独立表单 | 完成检查 |
| --- | --- | --- | --- |
| `chinese-diabolo` | 隐藏 | 无 | 无文字入口／无书写条件 |
| `korean-yutnori` | 隐藏 | 无 | 无文字入口／无书写条件 |
| `russian-matryoshka` | 隐藏 | 无 | 无文字入口／无书写条件 |
| `japanese-koinobori` | 可见 | 无 | 无文字入口／无书写条件 |
| `japanese-kendama` | 隐藏 | 无 | 无文字入口／无书写条件 |
| `indian-charkha` | 隐藏 | 无 | 无文字入口／无书写条件 |
| `german-nutcracker` | 隐藏 | 无 | 无文字入口／无书写条件 |
| `mexican-molinillo` | 隐藏 | 无 | 无文字入口／无书写条件 |
| `malawi-sansi` | 隐藏 | 无 | 无文字入口／无书写条件 |
| `chinese-suanpan` | 隐藏 | 无 | 无文字入口／无书写条件 |
| `mongolian-felt-ger` | 隐藏 | 无 | 无文字入口／无书写条件 |
| `peruvian-engraved-gourd` | 隐藏 | 可选 | 检查点 2 已有免输入 |
| `venetian-glass-bead` | 隐藏 | 无 | 无文字入口／无书写条件 |
| `korean-bojagi-wrap` | 可见 | 无 | 无文字入口／无书写条件 |
| `vietnamese-bamboo-dragonfly` | 隐藏 | 无 | 无文字入口／无书写条件 |
| `turkish-ebru-paper` | 隐藏 | 可选 | 检查点 2 已有免输入 |
| `indonesian-angklung` | 隐藏 | 无 | 无文字入口／无书写条件 |
| `weifang-paper-kite` | 隐藏 | 无 | 无文字入口／无书写条件 |
| `chinese-shadow-puppet` | 隐藏 | 可选 | 检查点 2 已有免输入 |
| `faroese-wool-knit` | 隐藏 | 无 | 无文字入口／无书写条件 |
| `niue-shell-necklace` | 隐藏 | 可选 | 检查点 2 已有免输入 |
| `polish-paper-cut` | 隐藏 | 可选 | 检查点 2 已有免输入 |
| `uzbek-clay-bowl` | 隐藏 | 无 | 无文字入口／无书写条件 |
| `chinese-woodblock-print` | 隐藏 | 可选 | 检查点 2 已有免输入 |
| `czech-bead-star` | 隐藏 | 无 | 无文字入口／无书写条件 |
| `fijian-woven-fan` | 隐藏 | 无 | 无文字入口／无书写条件 |
| `amazigh-woven-rug` | 隐藏 | 可选 | 检查点 2 已有免输入 |
| `slovak-wire-bird` | 隐藏 | 无 | 无文字入口／无书写条件 |
| `hungarian-embroidery-hoop` | 隐藏 | 可选 | 检查点 2 已有免输入 |
| `andalusian-ceramic-tile` | 隐藏 | 可选 | 检查点 2 已有免输入 |
| `sicilian-painted-cart` | 隐藏 | 无 | 无文字入口／无书写条件 |
| `bai-indigo-cloth` | 隐藏 | 可选 | 检查点 2 已有免输入 |
| `ndebele-painted-house` | 隐藏 | 无 | 无文字入口／无书写条件 |
| `purepecha-copper-bowl` | 隐藏 | 无 | 无文字入口／无书写条件 |
| `welsh-love-spoon` | 可见 | 可选 | 检查点 2 已有免输入 |
| `barcelos-clay-rooster` | 可见 | 可选 | 检查点 2 已有免输入 |
| `finnish-birch-basket` | 隐藏 | 无 | 无文字入口／无书写条件 |
| `croatian-licitar-heart` | 可见 | 可选 | 检查点 2 已有免输入 |
| `catalan-festival-giant` | 隐藏 | 无 | 无文字入口／无书写条件 |
| `sorbian-painted-egg` | 可见 | 可选 | 检查点 2 已有免输入 |
| `basque-sunflower` | 可见 | 可选 | 检查点 2 已有免输入 |
| `breton-banner` | 隐藏 | 无 | 无文字入口／无书写条件 |
| `lithuanian-straw-garden` | 可见 | 无 | 无文字入口／无书写条件 |
| `dalarna-wooden-horse` | 隐藏 | 无 | 无文字入口／无书写条件 |
| `aland-votive-ship` | 可见 | 可选 | 检查点 2 已有免输入 |
| `blang-tea` | 隐藏 | 无 | 无文字入口／无书写条件 |
| `minangkabau-spinning-top` | 隐藏 | 可选 | 检查点 2 已有免输入 |
| `chinese-incense` | 可见 | 无 | 无文字入口／无书写条件 |
| `hongsheng-red-string` | 隐藏 | 可选 | 检查点 2 已有免输入 |
| `italian-ex-voto` | 可见 | 可选 | 检查点 2 已有免输入 |
| `czech-pilgrim-journal` | 隐藏 | 无 | 无文字入口／无书写条件 |
| `omikuji` | 可见 | 无 | 无文字入口／无书写条件 |
| `polish-blessing-basket` | 可见 | 可选 | 检查点 2 已有免输入 |
| `navruz-sumalak` | 可见 | 无 | 无文字入口／无书写条件 |
| `floating-lantern-loy-krathong` | 可见 | 可选 | 检查点 2 已有免输入 |
| `omamori-cycle` | 可见 | 可选 | 检查点 2 已有免输入 |
| `shrine-suzu-bell` | 可见 | 无 | 无文字入口／无书写条件 |
| `st-brigids-cross` | 可见 | 无 | 无文字入口／无书写条件 |
| `bokjori` | 可见 | 无 | 无文字入口／无书写条件 |
| `ema-votive-plaque` | 可见 | 可选 | 1：留白 → 2：挂牌 |
| `clootie-well-rag` | 可见 | 无 | 无文字入口／无书写条件 |
| `diya-oil-lamp` | 可见 | 无 | 无文字入口／无书写条件 |
| `votive-candle-catholic` | 可见 | 可选 | 检查点 2 已有免输入 |
| `daruma-eye-painting` | 可见 | 可选 | 1：确认愿望 → 2：归座 |
| `mizuhiki` | 可见 | 可选 | 检查点 2 已有免输入 |
| `milagros` | 可见 | 可选 | 已有免输入；已取消草稿随完成保存 |
| `phuang-malai` | 可见 | 可选 | 已有免输入；已取消草稿随完成保存 |
| `woodfish` | 可见 | 无 | 无文字入口／无书写条件 |
| `celtic-folk-spring` | 隐藏 | 可选 | 已补终步静看 |
| `theravada-water` | 隐藏 | 无 | 无文字入口／无书写条件 |
| `tanzaku-tanabata` | 可见 | 可选 | 检查点 2 已有免输入 |
| `yeondeunghoe` | 可见 | 无 | 无文字入口／无书写条件 |
| `furin-wind-chime` | 可见 | 无 | 无文字入口／无书写条件 |
| `shinto-torii` | 可见 | 可选 | 检查点 2 已有免输入 |
| `tibetan-wheel` | 可见 | 无 | 无文字入口／无书写条件 |
| `slavic-wreath` | 可见 | 可选 | 检查点 2 已有免输入 |
| `crane` | 可见 | 可选 | 检查点 2 已有免输入 |
| `lantern` | 隐藏 | 可选 | 1：挂木牌 → 2：静看 |

## 可见场景的心意与文化边界

可见场景的提示改为在心里确认祈愿、谢意或惦念的人，并继续已有真实动作／静看按钮；不在体验中要求“写好了”、输入或提交。方巾裹礼由其场景维护者同步，其余 20 个可见写愿模块在本轮一起核对。

本轮未新增传统起源、节期、资格、次序、数量或灵验主张。免输入、完成后自愿记录、完成反馈和辅助按钮均是产品安排，不能由此反推传统本来不书写。绘马、七夕短册已有来源里的真实书写与悬挂关系保留；达摩仍先点一目立愿，在心里确认目标后归座，补目条件仍为愿成或平安度过一年后的谢恩，不把任意回访解释为事成。

受影响事实与边界沿用[全场景文化核查](2026-10-19-scene-culture-audit.md)及其 A／B／C 逐项记录。本轮实际阅读对应来源卡和已有核查记录，用于限定本次产品改动；未将其冒记为重新访问外部来源正文。奥兰舟模末步删去一概归于“海上平安归来谢恩传统”的表达，按[现有来源卡](../../content/traditions/aland-votive-ship.md)限定为个人对平安与归来的珍惜。无需为免输入安排新造文化来源。

同步更新：

- 场景实现、必要的回归测试、泉景 README。
- 花环、小符的实际产品描述；绘马、达摩、神道卡中涉及当前产品的旧流程。保留传统事实，明确当前交互与早期提案。
- 宿主目录、注册表与模块 metadata 的来源分类未改变，因此无需改写这些字段；App 的共享记录交互由宿主集成变更维护。
- 独立模块仍可通过明确的非空表单提交调用保存；App 延后表单的行为由宿主适配器测试验证。本记录不把“未显示表单”当成完成条件已经被验证。

## 验证

- RED：新增／调整 3 个真实 DOM 回归，在修复前分别观察到泉景终步按钮隐藏、花环与小符完成动作保存未提交草稿；3 失败、106 通过。
- GREEN：最小修复后同组 109 项全部通过。
- 扩大到本轮 20 个可见模块、隐藏泉景及共享旧场景交互覆盖：19 个测试文件、657 项全部通过，`--maxWorkers=2`。使用真实 Three.js 几何、射线、表单与 DOM，仅替换测试环境没有的 GPU 渲染边界。
- 未运行整个仓库或启动重型浏览器；本轮按父任务并行资源约束运行定向测试，仓库级测试、构建与 App 浏览器核对由整合任务负责。技术通过不能代替文化事实审阅。
