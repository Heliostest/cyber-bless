# 第二批：木牌、布条与两种灯光

用户授权将第一批四场景合并并推送 master，然后继续制作下一批。沿用已确认的 Three.js 模块、奶油薄荷 UI、柔和体积渲染、CC0 本地环境和 0–3 步骤。

| id / 标题 | 主体与流程 | 环境 / 类型 |
|---|---|---|
| ema-votive-plaque / 木牌记愿 | 五角木牌，原创花叶彩绘、绳孔；翻到背面 → 写短愿或留白 → 挂到横梁 | 木廊 / 心愿 |
| clootie-well-rag / 井边放下 | 石井、低枝、织物布片；浸布 → 系枝 → 松手静看。保留布条，不以消失表示疗效 | 林地 / 祈福 |
| diya-oil-lamp / 灯旋一瞥 | 陶质敞口油灯、棉芯和油面；点亮三盏 → 拖灯沿圆弧旋转 → 放回盘上 | 傍晚庭院 / 祈福 |
| votive-candle-catholic / 留一盏烛光 | 蜡烛、蜡泪与烛架；取烛安放 → 点亮 → 留一句意向或静看 | 石廊 / 心愿 |

四种手感与形体独立。绘马使用原创花叶，避开特定神社纹样；井边布条不模拟疾病消退；Diya 与蜡烛各自有形制、颜色和动作，不复刻神像或圣所。所有文本为产品改编的练习或致敬，书写只保存用户提交的非空文字一次。还愿入口不产生新心愿。

照片来自仓库对应 .jpg，只用于观察，产品资产全部代码创建。已核对 [国学院绘马条目](https://d-museum.kokugakuin.ac.jp/eos/detail/?id=9608)、[FLS 井址指南](https://forestryandland.gov.scot/visit/destinations/munlochy-clootie-well)、[Science Museum 油灯藏品](https://collection.sciencemuseumgroup.org.uk/objects/co123880/oil-lamp-decorated-with-hindu-motifs) 与 [Saint Patrick 烛光介绍](https://www.saintpats.org/parish/catholics-light-votive-candles/)。灯盏的陶制轮廓取自本地照片，博物馆铜灯仅支持器物与文化背景。

恢复 0–3 不发送效果；暂停取消旧手势；减少动态效果可操作；按钮与器物动作均可完成；器物开始的单指才占用触摸；多指、取消、丢失捕获不推进。新模块共享一个小型指针所有权工具，避免重复第一批已发现的输入边界。只迁入新四场景，不重构已有模块。

登记独立引擎、目录描述、SVG 图标、色彩和环境。绘马与烛光加入心愿候选，布条与 Diya 加入祈福候选；核心 RitualId、存档版本与结算流程不变。

验收：真实几何射线与状态测试；全套测试、Web 构建、Android/iOS 离线导出；320/390/1280px 各步骤截图，直接手势、书写与恢复；19 场景进出 GPU 资源释放；独立审查。完成后本地提交新功能分支，下一次合并仍按用户指令。

## 验证与调整记录

- 第一批四场景已合并并推送 master：`5fa6819`；合并树完整 635 测试通过。本批分支 `codex/quiet-light-and-wish-scenes`。
- 最终全套 `npm test` 740 个测试通过；Web 构建通过。绘马 18、布条 23、油灯 22、烛光 9 个行为测试，指针工具 9 个 DOM 测试；宿主新增四个真实几何拖拽的暂停恢复检查。
- 指针工具覆盖器物外第一指/第二指、外部释放、丢失捕获、按钮按下期间的占用与监听释放。恢复步骤不模拟新输入，暂停取消旧手势。
- 窄屏检查发现布条世界边界越界，已后退相机；布条变形后同时重算包围盒、包围球和法线，水面命中体积可可靠接收中央投放。新增回归检查通过。
- 灯具与织物的灯光对象释放检查使用实际 shadow render-target，并验证一次释放。油灯与还愿烛专用暖色夜间补光，便于辨认陶土与蜡质；其他环境配方不变。
- 独立审查发现「静看烛光」错误保存未提交草稿；回归先失败后通过，静看只完成体验，书写必须由「写好了」或输入提交保存。最新生产浏览器复核零新增心愿。
- `scripts/test-quiet-light-scenes.mjs`：320/390/1280px 的 12 条完整流程、50 张截图、4 组直接射线手势通过，无页面错误或横向溢出。390px 步骤 2 经页面刷新恢复。绘马与烛光的真实还愿入口各只花费一个小物、加一条笔记，不另建心愿或功德。
- `scripts/preview-cozy-scenes.mjs quiet-light`：19 场景进出，无外网运行时请求，无页面错误；21 个 WebGL 上下文释放，GPU 存活资源回到 0。
- 最终 `npm run mobile:verify`：Android 与 iOS Native/DOM 离线导出通过，12 个场景资源哈希一致、24 个 iOS 小组件封面通过。真机 GPU 与安装包安装未验证。
- 证据：`artifacts/quiet-light-scenes/browser/report.json`、`artifacts/cozy-scenes/quiet-light/report.json` 与 `artifacts/four-craft-scenes/quiet-light-test-final.log`。原有 React 测试 act 提示与 Three.js 公共块体积提示仍在。
