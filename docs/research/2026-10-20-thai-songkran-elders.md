# 浇水敬老来源核查

场景 ID / 来源 slug：`thai-songkran-elders`。核查日期：2026-10-20（Asia/Shanghai）。新增独立场景，不更改隐藏的 `theravada-water`，也不复活空水面、花瓣、合十拼接的旧组合。

实际呈现：家庭宋干敬老浇水片段，一位坐着的长辈伸出双手；清水碗、接水盆、木凳、石垫；提碗、移碗、倾水并回放。祝愿长辈安康，同时保留求长辈新岁祝福的语境。没有留言要求、许愿输入、宗教功效保证或“练习”表述。

| 主张 | 来源、发布者、相关正文 | 读取状态 | 支持范围及边界 |
| --- | --- | --- | --- |
| 晚辈用清水或泰香水浇长辈手上，示敬并求新年祝福 | [泰国外交部](https://www.mfa.go.th/en/content/5d5bcfe115e39c306001c1c3?cate=5d5bcb4e15e39c3060006838)，Songkran/Thingyan…in Riyadh；2016-04-27发布/2022-11-28更新；2016-04-23活动；含 The custom of pouring clean water 的敬老段（父读取L160–162，复核当前L166） | 2026-10-20已读相关正文 | 支持本场动作、对象、清水与心意；不将年龄、日期或历史概述作统一规则；后文缅甸Eugenia叶/银碗不移植 |
| 家庭/邻里向长辈手上浇水，祝健康兴盛并求来年祝福 | [ICH Courier / ICHCAP](https://ichcourier.unesco-ichcap.org/board.es?act=view&bid=A102&list_no=697&mid=a10501000000)，A New Year Celebration Marked by Water Splashing: Songkran；Vol59 June2024，L138–151，重点L143/150 | 2026-10-20已读相关正文和文字图注 | 机构介绍，非具名家庭口述；不靠非遗身份作依据，直接依据动作与意义正文；无具体容器外形统一要求 |
| 各处礼节还可能有请谅解、头部用水、赠礼等更广流程 | [Thailand Foundation，Soonyata Mianlamai，编辑Tayud Mongkolrat](https://thailandfoundation.or.th/songkran-thai-new-year/)，Songkran – Thai New Year，页首2022-04-16，署名尾注2022-04-15，L90–92/144 | 2026-10-20已读相关正文 | 仅交叉参照礼节范围；不实施揉头/赠礼，不声称产品完成全礼；不把名称词源或Lanna泛化为全部家庭 |
| 家庭敬老与祝福，香水是可用水的一种 | [Tourism Authority of Thailand Newsroom](https://www.tatnews.org/2022/04/tat-announces-songkran-2022-festivities-in-new-normal/)，2022-04-05 16:24，L99/131–133 | 2026-10-20已读相关正文 | 2022活动报道交叉参照；不移植浴佛段器物、茉莉花环或当年防疫规则 |

源卡已检索：现有 `theravada-buddhism` 总卡确有 Rod Nam Dam Hua 研究，但当前绑定旧场景已判为产品创作；本项以对象明确的泰国家庭礼节专卡绑定，避免泛宗教归属。`dai-xishuangbanna` 等地区总卡不作泰国手部浇水证据。共享登记122项、全部待合并与B认领已按动作及别名查重，无同题。

读取限制：ICH图片链接只返回URL文本；一次浏览器图片载入超时，未声称看过图片。另一个猜测的TAT2023活动URL读取失败，未作为证据。来源正文足以支持清水浇双手与祝福，碗/凳/盆/普通衣着外形均明确属于产品造型。

传统事实与产品安排：前者为宋干家庭晚辈向长辈手上浇清水敬老、祝健康并求新年祝福；后者为预备水碗、坐姿/接水盆/石垫、两手相邻造型、三段交互、简短结束语与清水量动画。不声称起源、统一次数/期限、服饰资格、保证愿望实现，也不把真实祝福语境改成单纯放松。

同步：目录、意图/祝福池、registry/module metadata、引擎、图标、庭院环境、来源卡、README、原生小组件封面与标题、测试。验收报告在 `artifacts/thai-songkran-elders/validation.md`，文化独立复核在同目录 `independent-source-review.md`；技术测试仅证明实现一致，不能代替本文事实核对。

## 验证结果

完整场景库5409/5409项通过。新场景与注册表182项、App794项及必要包测试通过。独立43个实体网格、3003个姿态、物件支撑、碗对人物/盆/垫全采样路径、双掌受水、液面/跨唇/手面薄膜/落水连续链、12输入和3宿主检查通过；三档构图通过。有限采样不等同连续数学证明。首次凳面穿插、盆与腿鞋/垫/碗穿插、流柱碰碗壁、上沿法线、最低水面点与薄膜末缘断开等均有旧版失败及修复证据。

鼠标320/390/1280、原生CDP触摸模拟320/390的全部步骤、错误输入、键盘与恢复通过；13张动作图、实际录屏和事件日志、真实滚轮与完成点击、GPU零残留，无JS错误或外网请求。独立实际查看50张最终图，并锁定源码与图片哈希。三档WebGL封面、Web构建、widgets35/guard8、Android+iOS离线112脚本/14资产、iOS327封面哈希通过。Expo8项既有补丁建议保留，mobile:verify退出1；依赖未改。触摸为模拟，Windows未作Swift/Kotlin原生编译。

主目录73个WIP文件及HEAD/status、旧107条manifest/321封面不变，历史预览保留。当前预览5327。本分支108/正式41/隐藏67不代表累计；仅本地提交，由coordinate.mjs accept原子更新唯一ID总数和全部待合并清单。
