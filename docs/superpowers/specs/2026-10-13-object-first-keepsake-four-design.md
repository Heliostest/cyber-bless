# 四件日常物品与心意

用户授权自行选题、直接实现、集成、验证和本地提交，并要求逐个展示实际运行截图。启动为干净 master `57ad9b6`；本批分支 `codex/object-first-keepsake-four`。完成后留在功能分支，不自动合并或推送。

本批沿用已有物品优先架构、柔和圆润原创 Three.js 主体、奶油 UI、本地 Kenney / Poly Haven CC0 环境。不新增依赖、外网运行时资产或复用旧主体换皮。按 parallel-agents 技能将三个独立场景目录分派，root 实现手记、集成和验收；另设只读审查。无需再次设计审批。

| 场景 | 三个持久检查点 | 传统 / 分类 / 环境 |
| --- | --- | --- |
| chinese-incense / 炉前一炷 | 拖炉盖至盖托 → 将香的纸套拖入炉中香孔 → 点茶托静看 | chinese-folk-and-confucian / 祈福 / courtyard |
| hongsheng-red-string / 红绳自持 | 沿立式收线架的十二个弧点绕绳 → 拖扣头至合扣点 → 点绳环静看或明确提交文字 | hongsheng-red-string / 心愿 / veranda |
| italian-ex-voto / 绘牌记谢 | 拖调色盘上的笔头至陶牌归途起点 → 从笔头沿线向右上描窗光 → 点陶牌静看或明确提交感谢 | italian-ex-voto / 心愿 / veranda |
| czech-pilgrim-journal / 旅途一页 | 抓封面书角向左翻开 → 放入布书签 → 点页上叶形记号静看 | czech-moravian-folk / 祈福 / garden |

文化核对：已阅读四篇本地传统说明和对应参考照片。图片只用于观察，不嵌入产品。敬香取公开家庭／庭前语境，不模拟宗祠祭祖；红绳在界面并列展示文学典故与当代习惯，操作仅属现代自我关照手作，不由月老故事推导古礼，不作缘分配对；绘牌以原创归途与窗光表达日常感谢，不复刻圣像或代用户宣告神迹；手记受摩拉维亚朝圣步道启发，是现代产品改编，不声称为当地传统仪物，不模拟弥撒或朝圣完成。节分因本地卡片明确要求时节限制而未纳入本次全年目录扩展。

核对来源：[UNESCO 妈祖信俗](https://ich.unesco.org/en/RL/mazu-belief-and-customs-00227)、[光明日报文学源流文章](https://epaper.gmw.cn/gmrb/html/2021-02/19/nw.D110000gmrb_20210219_2-16.htm)、[Science Museum Group 德鲁塔还愿陶牌](https://collection.sciencemuseumgroup.org.uk/objects/co81737/votive-earthenware-plaque)、[捷克旅游局霍斯廷](https://www.visitczechia.com/en-us/things-to-do/places/landmarks/religious-monuments/c-holy-hostyn)。来源只支持背景，不替原创操作背书。

交互要求：射线直接命中可见几何，提示跟随物体，真实落点与 cue 一致，错误起点／落点不推进。键盘辅助调用相同完成路径。0/1/2/3 恢复无音效、保存、完成重放。只有明确提交表单才新增心愿；草稿加静默完成不保存，returning 不新增心愿。单指所有权，取消／丢失捕获／失焦／宿主暂停恢复不得产生误推进；暂停冻结已接受动画，销毁释放 DOM、监听、音频、几何、材质、灯影、渲染器与 WebGL context。

验证范围：场景真实几何与生命周期回归、registry/engine/icon/native-safe catalog/叙事/分类/环境契约、UTC 每日推荐全年覆盖、320/390/1280px 键盘和真实 cue 完整流程、逐步截图、保存与还愿、全目录无外网请求和 GPU 释放。`npm test`、`npm run build`、`npm run mobile:verify`，在线 Expo 版本检查与离线锁定 SDK 导出分开报告。构建与使用 dist 的验收串行。
