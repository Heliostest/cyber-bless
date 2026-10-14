# 毛线与贝链 Implementation Plan

> Use superpowers:subagent-driven-development and dispatching-parallel-agents for the two independent owned scene directories. Root owns integration, production validation and the final review.

**Goal:** 在 57 个场景及已采用的柔和三渲二上，增加两个 C / 低的公开工艺场景。基线 d44bf5f，复用现有附属 worktree；主工作区的移动发布改动不触碰。

| ID / 标题 | 地区索引 / 分类 | 三个动作 |
| --- | --- | --- |
| faroese-wool-knit / 毛线织暖 | faroese-folk / 祈福 | 拖动右针穿入预留线圈；向右下抽针带出新线圈并退出旧圈；轻点织片静看 |
| niue-shell-necklace / 贝链留光 | niuean-traditional / 许愿 | 将已备好的最后一枚黄色小螺壳沿露出的细线穿入；拖动绳端收拢贝链到弧形；静看或明确提交心意 |

毛线采用奶白与灰褐的原创简单织片、小木针和可辨认的真实线圈。只演示一针的缩略过程，绕线由过渡演示，不声称完成毛衣或教授特有针法；针、线圈和线团之间必须连接，材料不可凭空增加。贝链使用数十枚黄色小螺壳和细线，壳体有开口和螺旋、真实穿线通路；已穿好的长串盘置浅托，补入一枚后收拢，不能变成海扇贝或实心圆珠。比例、纹样、托架和配色为原创，不复制馆藏作品。两者使用新版 CEL_STYLE、日间柔光、接触支撑和实际可见物体命中。

## Evidence

- [Faroe Islands official portal: Wool Fashion](https://www.faroeislands.fo/arts-culture/wool-fashion)：当地日常编织与羊毛文化。
- [Visit Faroe Islands: The Faroese Wool](https://visitfaroeislands.com/en/see-do/cultural-experiences/heim-experiences/the-faroese-wool)：自然毛色、羊毛与编织社群背景；已阅读正文。
- [V&A: How things are made — Knitting](https://www.vam.ac.uk/blog/museum-life/how-things-are-made-knitting)：互锁线圈是编织材料结构；不把法国编织器教程当作法罗传统。
- [Craft Yarn Council instructor handbook](https://www.craftyarncouncil.com/files/CIP/CYC_CIP_Knit_Program.pdf)：普通下针的穿入、绕线、抽出和退旧圈；已读机构索引节选，完整 PDF 网页解析受大小限制。只作一般针法依据。
- [Te Papa / Salote Talagi: Kahoa Hihi](https://blog.tepapa.govt.nz/2014/10/16/the-beautiful-kahoa-hihi-of-niue-island-niue-language-week-2014/)：黄色陆生小螺壳、穿孔细线串连及当代饰物和赠礼意义；已读正文。
- [Te Papa collection FE012781](https://collections.tepapa.govt.nz/object/1372486)：2013 年纽埃制作者 Mokaline Makaia 的 Hihi lei 馆藏记录。仅作为物类依据，不复制艺术品。

传统卡均为 C / 低，只作地区索引。只展示公开手作欣赏，不加入教会圣事、身体礼仪或效力承诺；不模拟采集活体与处理过程。用户已授权自主继续公开工艺小批次，无需重复确认主题。

## Acceptance

- 0–3 静默恢复，正常 / 减少动态等价；真实对象的第一可见不透明表面命中，提示位于该表面。错误起点、反向、短位移、回拉和取消都不能完成。
- 暂停、失焦、捕获丢失、销毁清理，以及 prepareFeedback / onProgress / saveWish 的同步重入；每次 inactive 边界递增生命周期版本，已准备的旧输入不可穿越暂停。
- 44 px 原生辅助按钮可 Enter / Space，过渡中禁用。心愿只明确提交一次，静看草稿 / 恢复 / 还愿不另存。
- 真实 Three 几何、射线和提示测试，只替换 GPU 边界；主体全部顶点在 284×390、350×408、1280×600 内；小螺壳开口、针与线关系、托盘接触要检查。
- 全套测试、tsc / Vite、Android / iOS 离线导出；生产构建 320 / 390 / 1280 的键盘和物体输入、恢复、心愿、还愿，320 / 390 正常动画触摸；59 项目录加载退出与 GPU 清理；最终截图实际看图。

## Tasks

- [x] 1. Owned module faroese-wool-knit：测试 RED → 实现 → GREEN，自查；只写该目录与 artifacts/wool-shell-pair/wool-*。
- [x] 2. Owned module niue-shell-necklace：同上，只写该目录与 artifacts/wool-shell-pair/shell-*。
- [x] 3. Root：placement RED 后整合 daily catalog / registry / engines / icons / cozy environment / 相应测试 / 真实宿主生命周期 / 浏览器验证脚本。
- [x] 4. 独立只读审查与修复，完整测试、生产截图、资源及移动离线验证，报告并本地提交。

**Ruling:** 本批继续两个独立模块，使用技能要求的并行子任务；不扩充共享交互框架，保留现有严格生命周期回归。保留证据目录和预览，避免删除用户正在查看的渲染对照页。

## Final validation — 2026-10-14

- 目录由 57 增至 59。两模块分别 45 / 68 项测试通过；独立审查的 15 项附加检查通过。审查发现的反向起步 / 部分回拉误计步，以及细线越过螺壳顶孔内壁问题均已修复并复查，无未解决发现。
- 实景检查后，将织片调整为 90 个紧密交错的 V 形线圈，贝链调整为 32 枚间距清晰的小螺壳；保持原有柔和三渲二和真实材料连接。最终 19 个代码 / 测试 / 脚本文件与生产构建时的 SHA256 一致。
- 完整 `npm test`：8 个工作区、2,522 项通过。标准 Web `tsc -b` / Vite 生产构建通过。额外 scenes 包 `--noEmit` 仍有 5 个旧测试文件的既有类型诊断；这些文件与基线的 Git 内容相同，两个新模块无新增诊断。
- 生产构建：320 / 390 / 1280 px 的 6 条键盘与恢复流程、6 条真实物体流程及 1 条还愿流程通过，共 50 张截图。320 / 390 px 的 4 条正常动画原生触摸流程通过，共 16 张截图。均无运行错误或外部资源请求；已实际看图。
- 59 个场景实际使用柔和卡通，无回退；61 个 GPU 上下文全部释放，剩余 0。Android / iOS 离线导出分别包含 63 份 DOM 脚本、12 份离线资产；iOS 24 张组件封面通过核对。未进行手机真机 GPU 或商店验收。
- 证据与步骤画廊保存在 `artifacts/wool-shell-pair/`：`report.md`、`verification-summary.json`、`index.html`、`review/final-review.md`。主目录原有 67 个并行文件内容未变。本批保留在 `codex/wool-shell-scenes` 本地提交。

**Review scope ruling:** 不复制馆藏或匠人的完整艺术作品；不将缩略交互视为完整工艺教学，也不模拟活体采集和材料准备。以上均属于原计划的明确边界，未扩大验收结论。
