# 心愿页仅陈列祈愿／祝愿用途收藏

> 历史记录：本轮把当前用途 `blessing` 一并保留，仍会让主分类为祈福的陶牛、门松、千岁糖等进入心愿页。2026-10-30 已按用户明确的祈愿／祈福两类边界修正；当前规则与完整清单见[后续记录](2026-10-30-wish-primary-category-shelf.md)。这里的「祝愿」不是产品第三类。

核查日期：2026-10-28。变更范围：心愿页顶部 `WishRitualRack` 的收藏筛选。

## 实际呈现与处理

按用户要求，顶部只陈列当前 `sceneIntention` 分类为 `wish` 或 `blessing` 的已收下场景收藏。自省、感谢、礼敬、庆祝等其他用途的收藏不再上架，仍保存在原收藏页和存档中；全部被筛除时不显示空架，保留「去许愿」入口。原有目录可见性限制、逐份收藏、草稿优先、未用／已用状态和具体收藏入口继续沿用。

用途分类与可选记录权限分别处理。`wishScene` 是已存收藏的写愿用途标记，`optionalWish` 是当前场景是否允许可选写愿，都不能单独证明器物有无祈愿背景。风铃、纸鹤等现有 `blessing` 场景仍可陈列；当前木鱼警醒自省、签纸原创自省提醒、花环赠礼致谢等场景不再进入心愿页顶部。即使旧收藏带有 `wishScene: true`，也按当前场景用途筛选。未修改「去许愿」选择器对已有草稿的继续能力，不删除历史文字。

## 文化影响与证据范围

本次已阅读[场景来源规范](../scene-provenance.md)、[既有心意核查](2026-10-19-ritual-intentions.md)、[小物反馈记录](2026-10-28-wish-object-feedback.md)、实际陈列实现及当前用途字段，并查阅本地[木鱼](../../content/traditions/mokugyo-wooden-fish.md)、[御神签](../../content/traditions/omikuji.md)、[风铃](../../content/traditions/furin-wind-chime.md)、[花环](../../content/traditions/phuang-malai.md)来源卡的现有说明。本地记录用于确认现有用途及产品改编边界，不作为新增传统事实的独立证据；本次没有重新读取外部来源，不将其登记为已重新核验正文。

| 核查项 | 本次支持范围与处理 |
| --- | --- |
| 器物、材料、动作和完成条件 | 仅缩小宿主陈列范围；场景模型、材质、操作、完成条件及点按反馈不变。 |
| 用途与真实文化背景 | 沿用当前用途分类，不把御神签的真实占卜背景改写为传统只有自省，也不把风铃的「非写愿收藏」身份当作没有祈福背景。 |
| 新增文化主张 | 无新增起源、地域、寓意、数量、期限、顺序或效力主张；没有给器物补造传统用途。 |
| 来源身份与同步范围 | 各场景来源 slug／`product-original`、宿主目录、注册表、metadata、场景 README 和原生标题均未变化，无需改绑或重写。同步当前小物架设计，并在旧研究记录标明后续收窄。 |
| 技术兼容 | 不更改场景 ID、引擎、收藏副本、消耗记录、心愿或草稿字段；筛选不派发存档写入。 |

## 核查清单

- [x] 已对照实际宿主陈列、场景用途、交互和完成条件，未从产品设计反推传统。
- [x] 沿用既有场景文化边界，无新增文化事实及外部正文读取声明。
- [x] 未新增地域、社群或视觉相似错绑，未抹去已记录的真实宗教、祈愿或占卜背景。
- [x] 用途筛选与写愿权限分开，保留有据的祈愿／祝愿场景；无据或其他用途不因旧标记继续上架。
- [x] 设计与研究记录反映当前范围；未改变来源身份、场景内容、原生标题或存档兼容性。
- [x] 沿用的用户提示与筛选后实际行为一致；无祈愿收藏时不留下空架。
- [x] 已完成相关回归、构建、浏览器和独立审阅；全套测试的既有未通过项单独记录如下。

## 验证

- 既有架子回归调整后先观察到两项预期失败，再实现用途筛选；相关架子、新建心愿和心愿详情 3 个文件共 20 项通过。
- `npm.cmd run build -w @wbr/cyber-bless`：TypeScript 与 Vite 生产构建通过，仍有既有的大分块提示。日志：`artifacts/wish-rack-prayer-only-web-build.log`。
- 生产浏览器脚本 `scripts/verify-wish-ritual-rack.mjs` 在 320／390／1280px 通过显示与原交互检查；混合收藏只显示祈愿／祝愿物件，非祈愿即使带旧写愿标记也不显示、不影响未用计数；仅有非祈愿收藏时不显示空架。原始收藏数组保持一致，风铃与纸鹤反馈、逐份已用／未用／旧草稿导航、键盘／触屏／鼠标浏览、静音／减少动态效果和无 WebGL 降级均通过，无页面异常。报告：`artifacts/wish-object-shelf/browser.json`，筛选后截图：同目录 `prayer-only-390.png`，运行日志：`artifacts/wish-rack-prayer-only-browser.log`。
- 独立只读审阅未发现阻塞问题，确认收藏页及旧草稿独立入口未受顶部筛选影响；本次相关文件 `git diff --check` 通过。

App 全套并非全部通过：`npm.cmd run test -w @wbr/app` 为 42 个文件通过、1 个失败，1,287 项通过、1 项失败。失败为 `wish-object-feedback.test.ts:25` 的 `gives every current shelf object and compatible saved wish object a deliberate response`：`ukrainian-didukh` 当前返回通用反馈，与断言要求的独立配置不符。该测试、反馈实现 `wish-object-feedback.ts` 和输入目录 `daily-scenes.ts` 均与 HEAD 一致；单独重跑该断言仍有相同失败，未为本次陈列筛选扩改反馈配置。日志：`artifacts/wish-rack-prayer-only-app-tests.log`、`artifacts/wish-rack-prayer-only-existing-feedback-failure.log`。

技术验证仅确认陈列、权限和存档行为，不替代文化事实核查。
