# 介绍扩充：木鱼与六个产品原创场景

核查日期：2026-10-20。约束依据：[场景来源规范](../scene-provenance.md)。本记录与 [A 组](2026-10-20-scene-narratives-a.md)、[B 组](2026-10-20-scene-narratives-b.md)、[C 组](2026-10-20-scene-narratives-c.md)共同覆盖当前 131 项场景。

用户介绍保存在 [`original.ts`](../../packages/core/src/scene-narratives/original.ts)，经 `daily-scenes.ts` 的 `narrative` 字段进入 `RitualNarrativeBlurb`。研究记录说明证据边界，用户界面不展示研究标签。纯产品创作不为凑足国别、起源或传统寓意而添加外部文化身份。

## woodfish · 敲一敲木鱼

- 实际呈现：读取 `packages/app/src/woodfish-scene.ts`、`woodfish.tsx`、`ritual.tsx` 与宿主介绍。木鱼、木槌、敲击与余音；一轮十二次，宿主记录完成。没有经文诵唱，也不把数字当宗教规则。
- 既有卡：[chinese-buddhism](../../content/traditions/chinese-buddhism.md) 的木鱼专段；其他放生、法会等概览不作为本场景证据。既有[审阅 A](2026-10-19-scene-culture-audit-a.md#1-敲一敲木鱼woodfish)只作查证线索。

| 本轮主张 | 直接来源及已读位置 | 读取状态 | 支持范围与限制 |
| --- | --- | --- | --- |
| 中国云南木鱼、20世纪初实物、槌击配合佛教诵唱、鱼形警醒象征 | The Metropolitan Museum of Art，[Mu Yu](https://www.metmuseum.org/art/collection/search/505614)，首段器物说明与 Artwork Details 的 Date / Geography / Medium；藏品 2006.494。页面未给文章发布日期 | 2026-10-20 已打开并阅读上述相关正文及字段 | 只用具体实物年代，不称木鱼于20世纪起源；“鱼不眠”作为象征观念，不是生物事实 |
| 日本也有木鱼，形制不同；约1800–1889年的馆藏实例 | 同馆，[Mokugyo (木魚)](https://www.metmuseum.org/art/collection/search/502274)，首段与 Artwork Details；藏品 89.4.1711。页面未给文章发布日期 | 2026-10-20 已打开并阅读相关正文及字段 | 支持地域、馆藏年代、诵唱用途及警醒解释；不据此主张中日全部宗派的统一仪轨或传播路线 |

传统事实：保留木鱼与佛教诵唱及警醒象征的关联。产品简化：点按、余音、十二次与片刻静听是当前体验，不等于参加寺院课诵。缺口：未查得足以确定木鱼起源的早期文本，因此用户介绍以具体藏品年代为限，不对起源作判断。

最终来源仍为 `chinese-buddhism`。木鱼属于宿主引擎，没有注册表中的独立场景模块；[场景 README](../../packages/app/src/woodfish/README.md)指向实际实现。本轮未改标题、引擎、完成次数或声音。

## 六个产品原创场景

逐项读取对应 `scene.ts` 的器物构建、COPY、动作推进与完成分支，以及存在的 README。下表中的联想归属于本产品或体验者，不是历史、民族或宗教主张，因而不为它们伪造来源卡或联网“补证”。既有解除错误绑定的原因见 [2026-10-19 全场景审阅](2026-10-19-scene-culture-audit.md)；本轮未将未重读的旧外部来源登记为已读。

| 场景与 README | 实际器物、动作、结束条件 | 扩充内容与边界 |
| --- | --- | --- |
| [minangkabau-spinning-top](../../packages/scenes/src/minangkabau-spinning-top/README.md) · 木陀轻转 | 木板、木陀、棉绳、木珠；拉珠松绳起转，点帽停稳，再静看；可选文字不构成必填 | 介绍玩具各部件和起转到停下的观察；不重新声称米南加保来源、返乡礼俗或传统拉珠机构 |
| [hongsheng-red-string](../../packages/scenes/src/hongsheng-red-string/README.md) · 红绳自持 | 线轴、木架、槽道、红绳、金属色合扣；沿圆点绕线、合扣、静看，可选留言 | 将照看自己明确为当代手作的个人心意；不把月老文学故事推作绕架动作或姻缘效力的来源 |
| [czech-pilgrim-journal](../../packages/scenes/src/czech-pilgrim-journal/README.md) · 旅途一页 | 封面、纸页、原创山路线条、布书签、黄铜色夹口、叶形记号；翻书、夹书签、点页结束 | 解释旅行中停留与记忆的当代意图；不指定捷克圣地、历史路线、朝圣仪轨，无需留言 |
| [celtic-folk-spring](../../packages/scenes/src/celtic-folk-spring/README.md) · 泉边一念 | 环形泉沿、水面、金色信物、光点；俯身、放信物、静看结束 | 泉景为想象空间；个人可赋予“暂且放下”等联想，不写成凯尔特圣泉信念或疗愈效力 |
| [theravada-water](../../packages/scenes/src/theravada-water/README.md) · 花水位一倾 | 水壶、盆状水面、花瓣、光点；倾水、放花瓣、合十结束 | 描述三种物件及倾注过程；不将没有供像、受水人或回向文的组合等同浴佛、敬老、浇水回向，不否定这些真实实践本身 |
| [lantern](../../packages/scenes/src/lantern/README.md) · 月下一灯 | 木架、竹骨纸灯、木牌；点亮、挂牌、静看；心愿可留白 | 介绍停在眼前的纸灯和当代个人祝愿；不声称节庆传统，不说灯会升空或漂流，不给挂牌动作指定国家或古老起源 |

最终分类均保持 `product-original`：注册表与对应模块继续使用 `PRODUCT_ORIGINAL`，宿主继续省略 `traditionSlug`。这些场景仍在 App 隐藏列表，保留 `/scene-review` 与历史存档访问。没有新增传统卡，没有改技术 ID、引擎版本、交互、音效、震动或完成条件。

## 与技术验证的关系

上述核查是人工的内容与来源审阅。段落渲染、完整覆盖、来源分类、隐藏策略与浏览器布局检查另见[本轮汇总](2026-10-20-scene-narratives.md)，测试通过不代替上述事实判断。
