# Village Four 实施与验证记录

Spec: docs/superpowers/specs/2026-10-13-object-first-village-four-design.md

## 整合前一批

festival 批次 `764f171` 合并前后分别通过 1,504 项测试及木鱼资产检查。`d1838b5 Merge four object-first festival scenes` 已推送 origin/master，并以 `git ls-remote` 核对 SHA。日志：`artifacts/festival-premerge-tests.log`、`artifacts/festival-merged-tests.log`。

## 本批进度

- [x] 四个原创场景及 110 项模块针对测试（陶鸡 27、桦篮 27、彩心 32、巨偶 24）。
- [x] 目录、图标、分类、叙事、环境、引擎集成。
- [x] 宿主生命周期 29 项、完整 1,642 项测试与生产构建。
- [x] 独立只读审查与 110 项针对测试复验。
- [x] 生产三屏宽交互与全目录布局、GPU 验收。
- [x] 移动端离线导出通过；在线兼容检查保留既有五项提示。
- [x] 本地提交并保留功能分支 `codex/object-first-village-four`。

## 已观察的失败与修复

巨偶先用空模块复现没有可见动作的断言失败，再实现物品交互。目录四条新入口断言也先因缺项失败。巨偶新增正面射线回归，确认褶皱裙面三角形绕序反向，并修复；开发截图发现裙边部分埋入布面、头发遮住额头，先补可见表面回归，分别确认裙边与额头断言失败，再用贴合褶皱的曲线饰边及收短的发盖修复。巨偶目前 24 项针对测试通过，390px 开发键盘与物品流程通过。

初次接入时桦篮尚为空模块，宿主测试因缺失网格失败；元数据暂含多余 tap 项，模块作者已对齐。冻结后的 registry 51 项与宿主生命周期 29 项全部通过。陶鸡测试发现并修复未提交草稿残留和尾羽取景裁切；彩心测试发现并修复单点丝带即可推进的问题；桦篮支撑回归发现提梁两端未触篮沿，调整宽度后通过。

## 最终验证

冻结后 `npm test` 通过 1,642 项测试和木鱼资产校验；`npm run build` 成功，保留既有 500KB chunk 提示。日志 `artifacts/village-final-tests.log`、`artifacts/village-final-build.log`。开发预览四场景 390px 键盘／真实物品／写愿回访流程通过，root 已检查初始与安放/悬挂图像。

最终生产构建另存到 `artifacts/village-production-20261013-1410`，以 http://127.0.0.1:5184/ 独立只读预览用于验收；index.html SHA256 为 `16a203cb9e782de170cd9e52a902b66d5bad7694e0cdce0a582483eaa41339c8`。后续不重建该目录，避免并行商店截图工作刷新主 dist 影响验收。

生产 GPU 审计通过全目录 43 个场景：共创建 44 个上下文、释放 44 个、残留 0，浏览器错误与外部请求均为 0。报告 `artifacts/cozy-scenes/village-four/report.json`，日志 `artifacts/village-gpu-browser.log`。

root 已检查最终生产版四张 390px 物品完成第二步截图：陶鸡完整拱尾、桦篮交织条带与提梁、彩心浮雕与挂环、巨偶额头与贴合裙边均可见，输入区与辅助动作正常排布。

生产版四场景在 390 / 320 / 1280px 下通过 12 条键盘、恢复与提示流程，12 条真实物品操作及无效手势流程，并通过陶鸡和彩心的 2 条还愿流程，共 100 张截图；错误和外部请求均为 0。还愿仅写回访记录并消耗对应小物，静看不保存未提交草稿。报告 `artifacts/village-four-scenes/browser/report.json`，日志 `artifacts/village-final-browser.log`。root 另检查 320px 陶鸡与彩心写愿区、1280px 巨偶与桦篮，未见越界或裁切。

全目录 43 场景 × 3 屏宽共 129 项布局检查，以及 5 条既有物品流程全部通过，错误为 0。报告 `artifacts/object-first-scenes/browser/layout-report.json`、`artifacts/object-first-scenes/browser/report.json`，日志 `artifacts/village-object-browser.log`。

独立只读审查完成全部四模块及共享集成，未发现 actionable findings；关闭缓存独立运行 110 项针对测试通过。审查者另核对了葡萄牙陶艺协会、芬兰国家博物馆、克罗地亚文化部与加泰罗尼亚巨偶协会的一手文化依据。实际浏览器视觉／GPU、移动导出、完整测试与并行商店工作未由审查者重跑，分别由 root 验证或排除本批。

`EXPO_OFFLINE=1 npm run mobile:verify` 成功：typecheck、8 项 Node 回归、Android/iOS native 与 DOM 导出，以及离线 HTML/JS/CSS/资产校验通过；各平台 47 个 DOM 脚本、12 个资产共 13,466,736 字节，iOS 24 张 widget 封面。输出 `apps/mobile-expo/.expo-export-check/verify-sBuFYw`，报告时间 2026-10-13T06:12:47.149Z，日志 `artifacts/village-mobile-offline-final.log`，本批固定摘要 `artifacts/village-mobile-verification.json`。离线校验使用锁定 SDK 内置表，不替代在线版本检查或实体设备运行。

暂存检查仅发现三处末尾空行，已移除；未改变已验收的程序行为。

在线 `npm run mobile:verify` 的 typecheck 通过，但 Expo 兼容检查保留五项补丁差异：`@expo/ui` 57.0.22→~57.0.23、`expo` 57.0.27→~57.0.28、`expo-dev-client` 57.0.19→~57.0.20、`expo-splash-screen` 57.0.9→~57.0.10、`expo-widgets` 57.0.23→~57.0.24。日志 `artifacts/village-mobile-online.log`；本批不混入依赖升级。

## 并行工作边界

同一工作区另有 iPhone 商店截图、上传脚本、截图文档及 package.json 的两个入口变更。本批不修改或提交这些文件；最终工作区可能保留它们。
