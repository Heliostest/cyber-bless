# 四场景收藏物的触碰反馈补齐

核查日期：2026-10-29。变更仅位于 `packages/app/src/wish-object-feedback.ts` 的收藏展示音效／动画映射及对应回归测试，不修改场景模型、实际手势、完成条件、心愿、奖励或文化文案。

## 问题与实际对象

先运行 `npm.cmd run test -w @wbr/app -- src/wish-object-feedback.test.ts`，原 29 项中 28 项通过、1 项失败：当前公开收藏物覆盖检查首先发现 `ukrainian-didukh` 落到未知物品的 `air/quiet` 默认反馈。继续核对新合并四场，四者均缺少专属映射；覆盖测试在第一个缺失项即退出，因此原日志未逐项列出另三者。

本次实际阅读四场 README 与 `model.ts`，按眼前产品物体选择已有音效与已有动画，不将代码中的材质或展示反馈当作传统事实证据。

| 场景 | 实际实现核对 | 收藏展示反馈与理由 |
| --- | --- | --- |
| `hindu-coconut-offering` | `coconut-whole`／椰壳半体，有褐色硬壳、纤维与白色果瓤，最终由石面承托 | `hollow/rock`：沿用主分支已登记的空腔音效与轻摇回弹；不重新表演破果 |
| `mezuzah-doorpost` | 闭合蓝绿护盒、铜色端帽与边饰、胶背；不打开经卷 | `metal/weight`：对应当前模型的金属边饰，以轻微竖向反馈保持固定物的稳定感；不模拟敲钉、摇晃经卷或宗教动作 |
| `sri-lankan-bodhi-puja` | `bodhi-water-pitcher`，陶色壶体与树旁承台、根旁供水 | `ceramic/weight`：对应产品陶壶，轻微底部回弹；不再次倾水或改写供水含义 |
| `ukrainian-didukh` | `didukh-sheaf`，麦秆、麦穗、芒与系带，立于屋角 | `air/nod`：沿用植物类柔和声音，围绕下部作小幅点动；区别于未知物品的居中缩放 |

`scottish-first-footing` 已有 `stone/weight`，不在本轮补齐范围内；实际四场合并名单沿用[四场集成记录](2026-10-28-four-scenes-i18n-integration.md)。

## 来源与文化影响

依[现行核查规范](../scene-provenance.md)，这是宿主收藏展示的产品技术补齐。原场景的器物、材料、造型、动作、对象、场合、文字、来源卡、注册表、metadata、原生标题与技术 ID 全部未改；没有新增起源、地域、宗教身份、传统动作、规则或功效主张。也没有把收藏触碰动画当成真实实践的操作方式。

实际场景与既有文化边界分别见：

- [椰果场景 README](../../packages/scenes/src/hindu-coconut-offering/README.md)与[研究记录](2026-10-23-hindu-coconut-offering.md)。
- [门柱经卷 README](../../packages/scenes/src/mezuzah-doorpost/README.md)与[研究记录](2026-10-24-mezuzah-doorpost.md)。
- [菩提供水 README](../../packages/scenes/src/sri-lankan-bodhi-puja/README.md)与[研究记录](2026-10-24-sri-lankan-bodhi-puja.md)。
- [迪杜赫 README](../../packages/scenes/src/ukrainian-didukh/README.md)与[研究记录](2026-10-24-ukrainian-didukh.md)。

本次读取的是上述 README 的呈现与产品边界，没有重新访问其外部文化来源，不声称追加一次文化事实考证。来源字段与来源卡无需同步改写；测试仅证明收藏展示映射覆盖与实现一致。

## 验证

新增四种表面音效案例和麦束下部锚定动画回归后，修复前 34 项中 5 项失败，分别暴露三个错误默认音效、全目录覆盖缺口与麦束错误默认动画。补齐四个映射后，同命令 34 项全部通过；原有未知 ID 默认反馈、动画首尾一致性、单次播放与独立帧数据检查仍通过。

合并前完整 `npm.cmd run verify` 退出码 0：App 1305 项、场景 10221 项及其他工作区测试通过；Web 构建、国际化和移动端完整校验通过。此记录不将这些技术结果作为文化事实证据。

合并时确认主分支已在四场景整合中独立补齐同一缺口；最终保留主分支的四条映射（椰壳使用既有 `hollow/rock`），消除重复键与重复表面案例，另保留麦束锚点回归。前述分支测试记录为合并前验证，最终合并结果另行复验。

最终 master 合并树已再次运行完整 npm run verify，退出码 0；全量工作区测试、国际化、Web 构建及 Android/iOS 离线嵌入检查通过。
