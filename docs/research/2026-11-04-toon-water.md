# 仪式水体盘点与调试台 Toon Water

核查日期：2026-11-04。用户要求检查仪式中的水，并将本地 Shader Gallery 的 Toon Water 接入调试台。先对照实际 `scene.ts` / `model.ts`，再核对共享 `stylized-water.ts`、`ritual-optics.ts` 的真实材质；没有以场景标题或地区推断存在水。

## 实际水体

共 15 场使用可切换的水体。网格数包含暂时隐藏、随动作出现的水流/水滴，不表示当前镜头内可见数量。计数与实际浏览器注册结果对应。

| 场景与现有核查入口 | 实际水体与材质路径 | 网格数 | 来源身份（保持） |
| --- | --- | ---: | --- |
| [泉边一念](../../packages/scenes/src/celtic-folk-spring/README.md) | 圆泉池，共享浅水 | 1 | `product-original` |
| [叶舟寄意](../../packages/scenes/src/floating-lantern-loy-krathong/README.md) | 码头旁放舟河面，共享浅水 | 1 | `floating-lantern-loy-krathong` |
| [竹筒叩石](../../packages/scenes/src/japanese-shishi-odoshi/README.md) | 接水池、竹筒内水平水面、进水柱、出水柱与溢水薄片 | 5 | `japanese-shishi-odoshi` |
| [纸雏祈安](../../packages/scenes/src/mochigase-nagashibina/README.md) | 草托放流的缓流水面，共享浅水 | 1 | `mochigase-nagashibina` |
| [火边花环](../../packages/scenes/src/slavic-wreath/README.md) | 花环漂行河面，共享浅水；原有几何起伏保留 | 1 | `kupala-wreath` |
| [花水位一倾](../../packages/scenes/src/theravada-water/README.md) | 浅盆水面和倾注水流，共享浅水与水材质 | 2 | `product-original` |
| [龟岩投愿](../../packages/scenes/src/udo-undama/README.md) | 岩旁海面，共享浅水 | 1 | `udo-undama` |
| [泉水净币](../../packages/scenes/src/zeniarai-coin-washing/README.md) | 无 UV 泉池水面、勺中水、倾注与水滴 | 6 | `zeniarai-coin-washing` |
| [蓝白晾晴](../../packages/scenes/src/bai-indigo-cloth/README.md) | 清洗桶水面，既有水材质 | 1 | `bai-tie-dye` |
| [井边放下](../../packages/scenes/src/clootie-well-rag/README.md) | 井内圆形水面，既有水材质；透明拾取辅助体不覆盖 | 1 | `clootie-well-rag` |
| [浴佛发愿](../../packages/scenes/src/fgs-buddha-bathing/README.md) | 浴盆水、勺中水、水流、径流水滴与波纹 | 10 | `fgs-buddha-bathing` |
| [浇水敬老](../../packages/scenes/src/thai-songkran-elders/README.md) | 碗内水、接水盆水、水流、水滴与波纹 | 6 | `thai-songkran-elders` |
| [清水七供](../../packages/scenes/src/tibetan-water-bowls/README.md) | 七碗水、壶内水、水流与壶嘴水；水位联动仍用原几何 | 10 | `tibetan-water-bowls` |
| [菩提供水](../../packages/scenes/src/sri-lankan-bodhi-puja/README.md) | 壶内水、流向根土的分段水流与落水点 | 23 | `sri-lankan-bodhi-puja` |
| [椰果献愿](../../packages/scenes/src/hindu-coconut-offering/README.md) | 开椰后在浅盘铺开的椰水 | 1 | `hindu-coconut-offering` |

明确排除：`kagami-biraki-sake` 的酒液，以及 `turkish-ebru-paper` 的浮彩承载液/颜料纹样。二者虽然已有通用 `kind: water` 光学参数，却不能因此当作清水覆盖。`czech-pilgrim-journal` 的蓝色地图线是绘制符号，没有液体网格；茶汤、蜜、油、玻璃等也不按颜色或透明度猜作水。

## 实现与操作

开发版普通 App 和 `/scene-review?scene=celtic-folk-spring` 均可在左下角「调试台 → 水体渲染」选择「原有水体 / Toon Water」。无已接入水体的场景显示明确空态。收起面板保持观察；「恢复原有水体」或卸载调试台撤销本 App 的临时选择。选择只在当前调试会话存在，不进入正式偏好、仪式进度、存档或分享参数。

- `debug-water.ts` 根据实际渲染器注册可用水体，按 `.app-shell` 作用域隔离。
- `water-rendering.ts` 只覆盖已标记水面和 `ritualOptics.kind=water`，显式排除优先；支持材质数组、动态透明度、原面向与深度设置。
- 绘制在 `finally` 恢复原材质；覆盖层只释放自己的 ShaderMaterial。原几何、变换、拾取对象、容器水位、河流起伏和交互目标保留。
- 缺少 UV 时使用局部 XZ 投影。减少动态/暂停冻结水纹相位，长时间中断后只接受短增量；捕图与风格缩略图不推进时间。
- 普通生产渲染没有调试订阅，不执行水体清单扫描，也不启用临时选择。
- Shader Gallery 移植路径、精确文件哈希、作者、访问失败和未获明确授权状态见[技术来源记录](../../packages/scene-runtime/src/toon-water-ATTRIBUTION.md)。本次读取了本地归档，不把原站失败当作已读。

## 文化影响核查

本次仅新增开发者选择的水纹渲染。实际器物、材料身份、动作与完成条件、对象、场合、用户介绍/提示/结束语、宗教/占卜/祈愿背景均保持。Toon 色带是产品的可选显示方法，不是传统水纹、配色、材料或仪式规则。没有新增寓意、顺序、期限、数量、起源、资格、节期或功效主张。

传统事实和产品简化沿用上表各场景 README 的核查与来源卡。`celtic-folk-spring` 和 `theravada-water` 的 `product-original` 保持，依据沿用已读的[2026-10-19 来源核查](2026-10-19-scene-culture-audit.md)；其他既有水材质的局部支持范围沿用[2026-10-28 逐场材质核查](2026-10-28-material-lighting-audit.md)。菩提供水与椰果献愿的宗教背景保持，引用其现有专卡与专项研究；本次未把相关外部来源登记为重新读过。

来源卡、宿主目录、注册表、模块 metadata 无字段变更，因此保留现有一致身份；不额外制造源卡。技术 ID、引擎版本及存档兼容性保持。新增/排除标记的五个场景 README 同步链接本记录。

## 验证记录

- 注册表和覆盖层先运行缺实现的失败测试，再通过实际 Three 对象验证作用域、原网格射线、材质数组、无 UV、动态透明度、冻结时间、释放与异常后恢复。
- 共享渲染入口验证普通绘制、捕图、暂停/减少动态与卸载；UI 验证收起保留、恢复与卸载撤销，原音效检查回归通过。
- `node scripts/verify-toon-water.mjs` 使用真实浏览器遍历上述 15 场，并检查酒液、浮彩承载液与无水场景排除；通过实际面板选择/恢复，确认画布实例和浏览器存档保持。另在真实 WebGL 检查 17 种视觉风格均有可见流动，没有回退或 shader 错误；390×844 面板在视口内。
- 实际截图与结构化报告位于 `artifacts/toon-water/`。模拟浏览器输入与显示检查不代表真机 GPU、触控和温控验证。
- `@wbr/scene-runtime` 全套 247 项、App 水体控件与原音效检查 4 项通过。独立代码审阅未发现需要修复的问题。
- 最终结果：`@wbr/scenes` 类型检查及 296 个文件的 10,765 项测试全部通过；`@wbr/scene-runtime` 247 项、App 水体控件与音效检查 4 项通过。最终 `npm run build`（含完整 i18n 校验）成功，保留 Vite 现有体积提示。158 个仪式的测试修订校验、`git diff --check` 通过。编译后的源码署名及 Web/Expo 资源署名已核对；开发水体控件没有进入生产 JS。技术验证不作为文化事实证据。

## 交付核查清单

- [x] 对照实际器物/材料/动作与已有文化身份；水体盘点没有用标题或地区推断来源。
- [x] 没有新增/变化的文化主张；纯渲染变化已引用既有核查。
- [x] 没有跨地区错绑或把配色/水纹当传统；真实宗教背景保留。
- [x] 来源读取状态如实记录；产品渲染与传统事实分别记录。
- [x] 来源卡、宿主、注册表、metadata、标题、引擎与存档身份保持；必要 README 同步。
- [x] 用户介绍、提示、状态和结束语保持，不增加承诺。
- [x] 最终技术测试与构建结果核对完成。

## 2026-11-05 提交整合

用户授权提交、合并并推送。本次使用独立检出，仅提交水体相关 43 个文件；原工作区的布局、其他场景显示与审计脚本改动不纳入。共享来源 notice 只取水体新增段，场景修订指纹根据实际提交树重新生成。

独立检出补齐真实 Git LFS 实体后，完整 `npm test` 通过，其中场景为 296 个文件、10,764 项；上文 10,765 项是此前包含其他未提交场景测试的工作区结果。期间 `master` 合入昼夜云层，水体提交同步到 `798f2fc5` 后重新生成唯一冲突的修订指纹；再次验证运行时 247 项、App 1,525 项、完整构建、15 场水体与 17 种视觉风格浏览器检查均通过，未改变本记录的文化影响边界。
