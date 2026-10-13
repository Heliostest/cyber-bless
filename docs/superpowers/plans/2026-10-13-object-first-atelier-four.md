# Atelier Four 实施与验证记录

Spec: docs/superpowers/specs/2026-10-13-object-first-atelier-four-design.md

## 前一批整合

用户确认清亮背景后，提交 `2aed488`，与 village 四场景一起合并为 `7b5df9d`，已推送 origin/master 并核对远端 SHA。合并前后分别通过 1,644 项测试；日志 `artifacts/clear-garden-premerge-tests.log`、`artifacts/village-garden-merged-tests.log`。本批继续于 `codex/object-first-atelier-four`，完成后本地提交。

## 本批实现

- 蓝白晾晴：有厚度的连续蓝白布，漂洗、搭上晾杆、静看或明确提交心愿。
- 彩墙寄家：原创彩绘墙面小屋，安装彩片、整屋安放、静看。
- 铜碗拾暖：有空腔与卷边的铜碗，轻拭、移至软毡、静看。
- 木勺寄情：真实凹勺面与镂空木柄，轻拭、安放、静看或明确提交心愿。

四个模块共 117 项针对测试（蓝白布32、小屋30、铜碗25、木勺30）。目录、原生安全分类、每日轮换、图标、80–120汉字叙事、引擎与共享环境一致。沿用已批准的清亮留白背景；铜碗镜头稍降低，让天空和远坡可见，同时保留碗口深度。

各模块 README 记录本地 C 级卡与配图审阅、可读机构来源、不可用线索，以及原创公共手工艺欣赏的边界。所有实物通过实际不透明表面命中；取消恢复整组，暂停冻结已接受动画。静看不保存草稿，还愿入口不出现心愿输入。

## 失败与修复

四个模块先以空实现观察缺失动作或物件输入层的 RED，再实现真实交互。目录四条新入口也先因缺项失败，日志 `artifacts/atelier-placement-red.log`。

- 木勺擦布接触断言发现其离桌面 .02，降低擦布初始高度后通过。日志 `artifacts/atelier-spoon-contact-red.log`、`artifacts/atelier-spoon-tests.log`。
- 铜碗作者的接触回归发现擦布倾斜朝向错误，改为向碗外展开厚度，保留实际表面接触。
- 蓝白布窄屏边界回归先失败，拉远相机后通过；盆底也改为接触地面。
- 独立审查发现检查点1的布背穿过盆壁。新增实际旋转体剖面内外分类，确认417个布顶点位于实心盆壁内。将盆与水面 z 从-.015移至-.10后归零，布、托杆和凳子位置不变。-.20试案会遮住桌面宽屏的水面命中点，未采用。最终320/390/1280命中均通过。审查者另核对17,666个布顶点，凳子包围盒内为0，凳面高度处最小间隙.03048。
- 完整复验暴露既有泉边场景的偶发点击失败。357个固定镜头时间的诊断在36059ms与92001ms复现：旧提示锚点x=0位于环形网格径向接缝。新增两个确定性回归先RED，再把提示点移至同一真实三角形内部的[.12,-1.65,0]。几何与命中逻辑不变。62项旧提示测试、357位置诊断均通过；临时诊断文件已移除，只保留两个回归。日志 `artifacts/atelier-legacy-seam-probe.log`、`artifacts/atelier-legacy-cue-red.log`、`artifacts/atelier-legacy-cue-green.log`。

## 最终验证

`npm test`：1,791 项全部通过，木鱼资产检查通过。`npm run build`：成功，保留既有500KB chunk提示。日志 `artifacts/atelier-final-accepted-tests.log`、`artifacts/atelier-final-accepted-build.log`。

最终只读生产目录 `artifacts/atelier-production-20261013-reviewed`，预览 http://127.0.0.1:5188/ ，index.html SHA256 `17897ddfc762c13593fcfe86056188044e4d63ae189399c19133a315d614406a`。不重建该目录，避免并行商店工作刷新主dist影响验收。

最终生产GPU检查：47场景，共49个上下文、释放49个、残留0，错误与外部请求均为0。报告 `artifacts/cozy-scenes/atelier-four-reviewed/report.json`，日志 `artifacts/atelier-gpu-accepted.log`。

最终固定生产版四场景在390/320/1280px下通过12条键盘、恢复与提示流程，12条真实物件操作和无效手势流程，以及蓝白布/木勺的2条还愿流程，共100张截图。错误与外部请求均为0。还愿只写回访记录并消耗对应小物，静看不保存未提交草稿。报告 `artifacts/atelier-four-scenes/browser/report.json`，日志 `artifacts/atelier-accepted-browser.log`。

全目录47场景×3屏宽共141项布局检查，以及5条既有物品流程全部通过，错误为0；包括调整提示点后的泉边场景。固定报告 `artifacts/atelier-object-report.json`，日志 `artifacts/atelier-object-browser.log`。

root逐张检查最终四张390px物件安放后截图，并另看320px蓝白布与木勺、1280px彩绘小屋，主体、提示和输入区无越界或裁切。生产目录中的验证没有混用开发热更新。暂存检查仅移除小屋测试末尾多余空行，没有改变程序行为。

独立只读审查覆盖四模块及共享整合，关闭布盆穿插问题后，无Critical/Important/Minor遗留。独立复验117项新模块测试。后续泉边两文件修复再次独立审查，确认新锚点位于现有三角形内部，62项旧提示测试通过。审查者未重跑GPU/移动端，它们由root验证；并行商店和法律文本工作明确排除。

`EXPO_OFFLINE=1 npm run mobile:verify` 成功：typecheck、8项Node回归、Android/iOS native与DOM导出、HTML/JS/CSS及离线资产校验通过。每平台51个DOM脚本、12个资产共13,466,736字节，iOS另核对24张widget封面。输出 `apps/mobile-expo/.expo-export-check/verify-TsknHE`；记录时间2026-10-13T07:46:00.105Z；固定报告 `artifacts/atelier-mobile-verification.json`，日志 `artifacts/atelier-mobile-accepted.log`。离线检查使用锁定SDK内置表，不替代在线版本检查或实体设备运行。

在线 `npm run mobile:verify` 的typecheck通过，Expo检查仍有既有五项补丁差异：@expo/ui57.0.22→~57.0.23、expo57.0.27→~57.0.28、expo-dev-client57.0.19→~57.0.20、expo-splash-screen57.0.9→~57.0.10、expo-widgets57.0.23→~57.0.24。日志 `artifacts/atelier-mobile-online.log`。本批不改依赖。

## 工作区边界

并行工作包括商店文档/截图/上传、App Store与Notion脚本、商店配置、package.json脚本及应用法律文本。这些变更均不纳入本批提交。只暂存本批模块、整合、测试和两份设计/验证文档；功能分支保留。
