# 收藏小物按材质与结构区分点按反馈

日期：2026-10-28。场景 ID：`crane`、`furin-wind-chime` 原生模型反馈；其余可见目录收藏由宿主提供按物品区分的展示动作与合成音。

## 实际呈现及文化影响

本次已阅读[场景来源规范](../scene-provenance.md)、[小物架首轮记录](2026-10-28-wish-object-shelf.md)、纸鹤和风铃的实际代码、README 及对应来源卡正文：[纸鹤](../../content/traditions/origami-crane-senbazuru.md)、[风铃](../../content/traditions/furin-wind-chime.md)。只沿用其中既有来源身份及产品边界，没有把旧卡作为新增文化事实的独立证据，也没有登记外部正文为本次重新读过。

| 变化／主张 | 实际呈现、读取状态及支持范围 |
| --- | --- |
| 纸鹤扇翅 | 在已完成的原模型上局部调整双翼折痕，头、身、尾不变。两次轻扇后恢复。它是用户要求的产品动画，不称作折纸技法、传统仪式或现实飞行。 |
| 风铃摆动 | 复用既有玻璃铃、铃舌及分段纸条，短暂叠加受控摆动，再恢复原轻风状态。不新增器物或祈愿规则。 |
| 分材质声音 | 本地合成轻柔纸声、铃感及其他材质感短音，是产品声音设计，未冒充真实录音、特定传统音色或仪式效力。 |
| 其他小物 | 在宿主只读展示层选择轻飘、垂摆、回正等动作，保留既有模型、名称、材料身份和场景流程；展示动作不作为传统步骤。 |
| 风铃及其他非许愿收藏 | 允许已完成的收藏出现在同一陈列中，显示「已完成」，名称仅打开具体收藏。未把祈福、感谢、自省场景改为许愿，也不把它们计入未用许愿物品。 |
| 来源身份 | `crane` 沿用 `origami-crane-senbazuru`，`furin-wind-chime` 沿用同名来源，其余场景原 slug／`product-original` 保持；无错绑或新建传统卡。 |

新增的文化事实主张：无。新增寓意、起源、期限、次数、资格、节期或效力主张：无。这里的两次轻扇和动画时长都是产品节奏，不是来源规定。真实祈愿和宗教背景仍由原介绍与来源卡呈现，没有改成「本来只是装饰」。

来源卡的产品呈现、两场景 README、宿主设计及本研究记录同步更新；注册表、模块 metadata、宿主场景目录及原生标题的文化分类／标题未改变，无需更换其绑定。引擎版本、技术 ID、收藏副本、进度和存档格式均保持。

## 核查清单与验证

- [x] 已逐项检查实际器物、部件、动作、完成条件和提示，没有用产品动画证明传统。
- [x] 无新增文化事实；产品拟声与动画边界已明确，不扩写外部来源读取状态。
- [x] 来源无地域、社群或视觉相似错绑，真实祈愿背景和原场景用途保持。
- [x] 两来源卡、两 README、宿主设计及研究记录反映最终新增展示反馈；未改技术 ID／来源分类。
- [x] 不保存进度／留言／变体，不再次完成或消耗物品；声音、震动和减少动态效果继续遵循设置。
- [x] 技术、浏览器与独立审阅已完成，完整仓库检查的未通过项如实列在下方。

## 技术验证与未通过项

- App 相关 6 个文件共 80 项通过：物品配置、音效桥、实际模型点按桥、收藏状态与旧入口、普通今日预览和木鱼专用只读内容适配。日志 `artifacts/wish-object-feedback-focused-tests.log`。
- 场景类型检查及 7 个相关测试文件共 141 项通过：真实双翼局部变形、头身尾固定、无撕裂／自交、精确复原、风铃及纸条跟随、连续点按上限、完成／暂停／退出／减少动态效果，以及原场景和操作音回归。日志 `artifacts/wish-object-feedback-scenes-tests.log`。
- shared 全套 44 项、scene-runtime 全套 192 项通过。新增音色覆盖频率、余音、边缘平滑、强度上限、静音与节点回收；运行时日志 `artifacts/wish-object-feedback-runtime-tests.log`。
- `npm.cmd run build -w @wbr/cyber-bless` 的 TypeScript 和 Vite 生产构建通过，仍有既有的大分块提示。日志 `artifacts/wish-object-feedback-web-build.log`。
- 最终生产浏览器在 320／390／1280px 通过一排约三件、滑动与离屏释放、静音和减少动态效果、触屏滑动不误触、原收藏／未用物品／旧草稿入口、无 WebGL 降级。纸鹤及风铃点按时截图像素变化且外框无动画，确认动作发生在模型内部；纸声、风铃音及空壳音的实际 Web Audio 缓冲长度分别为 0.38／0.95／0.24 秒。木鱼使用其专用只读内容适配，真实 WebGL 模型加载通过。没有进度、心愿或收藏消耗变化，没有页面异常。报告 `artifacts/wish-object-shelf/browser.json`，截图 `individual-responses-390.png` 等保存在同目录。
- 独立审阅发现扩大收藏陈列后木鱼需要专用上下文：已复用今日预览的只读内容适配、补回归并由浏览器验证；复审无剩余具体问题。相关改动 `git diff --check` 通过。

完整仓库检查并非全部通过，未修改相关的并行场景拿放工作来掩盖结果：

- `npm.cmd run test -w @wbr/app`：40 个文件、1,191 项通过；`hourly-scene-lifecycle.test.ts:174` 有 19 项原有场景流程断言失败，预期检查点 1、实际收到 2／3，涉及 brat-bride-cloth、korean-sotdae、japanese-kadomatsu、pucara-rooftop-bulls、chinese-longevity-lock、alasita-miniature-house、thai-songkran-elders、persian-esfand、mochigase-nagashibina、greek-vasilopita、tibetan-khata-greeting、shichigosan-chitose-ame、bulgarian-survakane、lanna-sand-pagoda、chinese-fu-paper、turkish-nazar-bead、japanese-hamaya、chinese-ruyi-scepter、romanian-martisor。日志 `artifacts/wish-object-feedback-app-tests.log`。这些场景的拿放流程不属于本次反馈改动。
- 顶层 `npm.cmd run build` 停在 i18n extraction：并行新增的 `packages/scenes/src/placement-inspection.ts` 中两条拿放／查看提示未注册；本次未加入新的 UI 文案，也没有修改该文件。日志 `artifacts/wish-object-feedback-build.log`。这与上方通过的直接网页构建分别报告。

技术测试不替代文化事实审阅；实际硬件的听感和震动感受不由自动化调用记录证明。
