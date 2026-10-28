# Gallery 视觉选项翻译自审记录

日期：2026-10-28

范围：`controls` 词表新增 27 条消息，包含八项可选视觉效果的标题、说明及十一项参数名称。语言为简体中文、繁体中文、英语、日语、韩语、西班牙语、葡萄牙语、法语。旧有词条和场景文案未修改。

自审内容：逐项对照中文源文，区分表面法线、几何高度、排线、纸墨、柔光、暗角、颗粒和方向边缘光；保持标题与可调整参数所指对象一致。英文 `Normal`、日文「法線」、韩文「법선」及西葡法语言中的 normals 均指表面法线。说明中的「深度」为图形深度，不表示器物或传统的历史深度。繁体采用「漸層」「著色」等界面用语。所有新词条均为可选图形效果描述，不新增器物材料、传统归属、仪式、寓意或效果承诺。

新消息前缀：`app.visual.galleryToon`、`pencilHatch`、`heightPalette`、`normalPalette`、`sketchContour`、`galleryOutline`、`spaceGrade`、`depthRim`（各含标题和 `.detail`），以及 `galleryRim`、`pencilScale`、`paletteStrength`、`normalStrength`、`sketchStrength`、`glowStrength`、`vignetteStrength`、`grainStrength`、`rimWidth`、`rimStrength`、`rimDirection`。

修改前 `node scripts/i18n-check.mjs --review` 已通过，八语言各 2930 条、无缺失或过期审阅记录。修改后完整性检查为八语言各 2957 条，新增 27 条的稳定 ID、可信源文和译文逐项对应。审阅 hash 经现有 `i18n:record-review` 流程记录。

此记录仅声明代理翻译自审与自动完整性、ICU、生成物检查，不声明母语审校、设备排版或文化事实的全面复核。

验证结果：`npm.cmd run i18n:extract`、`node scripts/i18n-check.mjs`、`npm.cmd run i18n:record-review`、`npm.cmd run i18n:compile`、`npm.cmd run i18n:verify` 均通过；`npm.cmd run i18n:test` 的 22 个包测试和 20 个脚本测试通过。原生词表 `--check` 仍通过，无原生标题变更。
