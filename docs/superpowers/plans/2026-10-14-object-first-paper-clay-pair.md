# 剪纸与陶轮 Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for owned modules and superpowers:dispatching-parallel-agents for the two independent directories; root owns integration and whole-batch verification.

**Goal:** 在已完成的 55 项目录上新增两项 C/低公开工艺场景，实际物体与材料变化驱动三检查点。
**Architecture:** 沿用 create(ctx: SceneContext): SceneInstance、真实 Three 射线及现有宿主，无新依赖、无共享交互框架改造。两目录互不依赖，根任务单独修改注册及浏览器集成。
**Tech Stack:** TypeScript、Three.js、React、Vitest、Playwright、Expo DOM。
**Spec:** 本对话确认沿用的自主公开工艺路线及本计划下列设计。基线 8a3e952；复用已附属的干净 worktree，不进入主目录或移动发布 worktree。

## 设计与边界

| ID / 标题 | 地区索引 | 分类 | 三个物体动作 |
| --- | --- | --- | --- |
| polish-paper-cut / 剪纸开花 | polish-folk-catholic | C/低，许愿，drag + wishWrite | 拿起真实剪刀，沿最后一道纸边剪开；拉动折纸边向左展开对称原创花叶；静看或明确提交心愿 |
| uzbek-clay-bowl / 陶轮慢成 | uzbek-folk | C/低，祈福，drag + spin | 在陶轮实体轮缘向右拖动启转；在真实泥坯外壁向上拉起，改变中空器形；轻点静看未烧成的泥坯 |

剪纸用深青纸 #376c68、奶白衬板 #efe6ce、木色 #bb9973、剪刀哑银；陶轮用温暖湿泥 #ad785a、深木 #937452、浅砂色 #c9bba1。两者保持清晰主体、安静日间廊台、透明画布。纸有真实厚度/镂空/折轴，剪刀有刃与手柄；泥坯必须有真实内壁、开口与厚底，拉起时更新形状而非整体缩放实心体。陶轮存在可见转动标记与支撑，不凭空浮动。减少动态模式接受同等手势并立即得到等价结果。

纸纹样原创，不复制匠人作品；只剪最后一道边线的缩略步骤，不声称完整手艺训练。泥坯终态仍未烧成，不用瞬间变色表示窑烧或上釉；不称为特定流派的复刻。地区卡仅作索引，不把日常工艺等同宗教礼仪或承诺效力。

## 工艺证据

- [Culture.pl / Adam Mickiewicz Institute: paper cutouts](https://culture.pl/en/article/kurpie-lowicz-kashubian-architectural-a-brief-guide-to-paper-cutouts)：折纸后剪切形成对称镂空；地方形式不同。已读机构正文。
- [华沙国家民族志博物馆：Kobiece ręce](https://ethnomuseum.pl/kobiece-rece/)：彩纸、剪羊毛剪刀与室内装饰，已读机构索引正文。
- [UNESCO: Ceramic arts in Uzbekistan](https://ich.unesco.org/en/RL/ceramic-arts-in-uzbekistan-01989)：黏土、日用器、家庭与作坊传承。已读完整机构索引正文，直接页面触发验证。
- [乌兹别克斯坦非遗目录：Kulolchilik](https://www.ich.uz/en/ich-of-uzbekistan/national-list/domain-5/440-kulolchilik)：陶轮与陶艺背景；直接页面暂不可用，索引可读。
- [UNESCO ICHCAP: Artistic ceramics](https://archive.unesco-ichcap.org/eng/ek/sub2017_7/pdf_down/6.%20KNOWLEDGE%20AND%20PRACTICES%20CONCERNING%20TRADITIONAL%20CRAFTSMANSHIP/10.%20Artistic%20ceramics.pdf)：制坯工序与师徒形塑器物的机构图录证据。

## Global Constraints

- 0–3 恢复；暂停/失焦/触摸取消/销毁不产生额外进度；正常和减少动态等价；回调同步重入不得取消真实指针所有权或跨检查点。
- 只命中首个可见不透明物体；错误起点、方向、取消、无位移不得完成非点击动作。物体提示须投影在实际命中表面且位于画布内。
- 44px 辅助按钮可用 Enter/Space；许愿通过现有真实输入组件明确提交一次，草稿与还愿不另存。
- 284×390、350×408、1280×600 的全部可见主体顶点可见，内外表面完整。保留真实几何测试，仅替换 GPU 边界。
- 主工作区的并行文件不改、不暂存；本批不执行远程推送或商店发布。

## Review Focus

1. 开始真实指针后 prepareFeedback/onProgress/saveWish 同步重新触发输入；真实动作仍只完成一次（模块测试）。
2. 暂停发生在已接受动作的过渡中、取消后的旧 pointerup、dispose 中的回调；不跨步、不残留资源（模块及宿主测试）。
3. 折纸镜像、镂空与泥坯内壁穿透；可见 cue 首次命中不得被背景/背面替代（模块几何测试、截图）。
4. 反向、短位移、回到起点、超量/非有限 dt；不会意外完成或跳动（模块及真实浏览器）。
5. explicit save / quiet draft / returning 的持久化分离，完成回访只留一条记录（模块及浏览器）。

## Tasks

- [x] Task 1：创建 packages/scenes/src/polish-paper-cut/{index.ts,scene.ts,scene.test.ts,README.md}。导出 meta 与 create；写上述 RED 回归后实现、GREEN、自审，保存日志至 artifacts/paper-clay-pair。不得改共享注册或 git index。
- [x] Task 2：创建 packages/scenes/src/uzbek-clay-bowl/{index.ts,scene.ts,scene.test.ts,README.md}。同 Task 1 测试顺序；不含许愿表单，保留 returning 安全。不得改共享注册或 git index。
- [x] Task 3：根任务先新增 placement RED，然后整合 packages/core/src/daily-scenes.ts、packages/scenes/src/registry.ts、packages/app/src/scene-engines.ts、scene-icons.tsx、packages/scene-runtime/src/cozy-environment.ts；更新对应测试与 narrative、真实宿主生命周期、scripts/test-next-four-scenes.mjs 的 paperclay 批次及两目录预览脚本。
- [x] Task 4：独立只读审查并修复；完整 npm test、Web tsc/Vite、EXPO_OFFLINE=1 npm run mobile:verify；最终生产构建的 320/390/1280 键鼠与 320/390 正常动画触摸、恢复/取消/心愿/还愿，实际看图；资源释放，报告及逐件最终截图。本地提交并保留工作区。

基线为上一批完整验证过且当前 git status 干净的 8a3e952（2,273 tests、生产构建与移动离线验证通过）。新批测试与截图单独记录，不能用旧截图代替最终证据。


## 最终验收记录

- 独立审查 26/26 通过，现无未解决问题；修复全局指针回调、每次瞬时暂停边界的准备动作失效，以及剪纸后撑与斜板接触。原始 RED 日志保留。
- 新模块测试：剪纸 54/54、陶轮 44/44；完整 npm test 共 2,389 项通过，含真实宿主全部三阶段的中断与重新操作。
- 标准 Web tsc -b / Vite 生产构建通过，保留既有大分块提示。最终 21 个源文件与构建时 SHA256 一致。
- 最终生产版 320/390/1280px 共 6 条键盘恢复、6 条实际鼠标手势、1 条还愿流程，50 张截图；320/390px 正常动画 CDP 触摸共 4 条流程、16 张截图。两矩阵均零页面/控制台错误、零外部请求。已实际看过最终截图。
- 57 项目录全部挂载退出，59 个 GPU 上下文全部释放，剩余跟踪资源为 0。
- EXPO_OFFLINE=1 npm run mobile:verify 通过；Android/iOS 各 61 份 DOM 脚本及 12 份离线资产通过，iOS 24 张组件封面哈希通过。未做真机或商店发布。
- 主工作区原有 67 个文件 SHA256 未变；仅本批 22 个文件进入本地提交，工作区保留，未合并或推送。
- 最终证据：`artifacts/paper-clay-pair/report.md`、`index.html`、`verification-summary.json`；独立审查 `review/report.md`。报告记录本地最终提交，诊断截图与中间失败日志不冒充最终产物。
