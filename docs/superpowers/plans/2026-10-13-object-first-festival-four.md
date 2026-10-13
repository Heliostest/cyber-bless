# Festival Four 实施与验证记录

Spec: docs/superpowers/specs/2026-10-13-object-first-festival-four-design.md

## 已完成的整合请求

用户要求“提交、合并、推送后，继续”。开始时工作区干净，handcraft 已提交为 `0cfc720`，其父为尚未合入主线的 keepsake `24fa09a`。Fetch 确认远端 master 未前进，合并前重新运行 1,376 项测试，通过后将两批共八个场景合为 `41aa367 Merge eight keepsake and handcraft scenes`。合并结果再次通过 1,376 项测试和木鱼资产校验，已推送 `origin/master` 并用 `git ls-remote` 核对远端 SHA 一致。日志 `artifacts/handcraft-premerge-tests.log`、`artifacts/handcraft-merged-tests.log`。

## 下一批实现

新分支 `codex/object-first-festival-four` 从已推送的 `41aa367` 创建。沿用用户已授权的自主选题和现有物品交互架构，无新增依赖、共享接口改造或运行时网络资产。三个独立模块由并行代理实现，root 完成草编与共享集成，另作独立只读审查。

- [x] 彩蛋寄春：原创回转蛋壳、贴面纹样、画笔与承托陶杯；描色、入杯、静看或明确写愿。
- [x] 太阳花迎门：原创纸木太阳蓟、独立花心、门框、挂环与木销；组装、悬起、静看或明确写愿。
- [x] 节旗轻展：原创折皱布旗、木杆横梁、太阳与波纹、边缝流苏、插座；展开、立稳、静看。
- [x] 草穗悬园：原创中空双锥草编、侧饰、独立小菱形、棉线与双木架；接合、悬起、静看。
- [x] registry、engine、图标、native-safe catalog、叙事、分类、环境和宿主生命周期集成。
- [x] 全套测试和生产构建。
- [x] 独立审查、最终生产浏览器与移动端验收（在线 Expo 补丁提示见下文）。
- [x] 本地提交新一批，保留功能分支；提交信息 `feat(scenes): add four object-first festival scenes`。

## 交互和失败回归

四模块共 100 项测试：彩蛋 27、太阳花 26、节旗 26、草编 21。测试使用真实 Three.js 几何、射线、提示和写愿控件，仅替换 GPU 边界。首可见表面判定阻止穿透前景物，落点只排除当前手持子树。有效拖动至少 8px、轻点轨迹小于 12px；错误起落点、多指、取消、失去捕获、失焦和宿主暂停不会推进。恢复 0/1/2/3 不重放保存、完成或触感；明确提交才新增心愿，静看丢弃未提交草稿，回访无写愿框。

草编先以无操作空模块复现“没有可见组装动作”的断言失败，之后实现；共享目录四项缺项断言同样先失败后通过。彩蛋检查了纹样距曲面、蛋与布垫和陶杯接触；太阳花最终补齐松散花心与垫片接触，修正 .041 单位空隙。首次全套运行与该修正重叠，读取到旧实现而报告这条接触失败；最终冻结后重新全套通过。节旗截图发现太阳纹样部分陷入折皱布面，新增曲面间隙回归先失败后通过，以同心网格细分修复。草编验证底饰随主体移动、悬点接触和暂停冻结父级运动。

`npm test` 最终通过 1,504 项测试和木鱼资产校验，`npm run build` 成功（保留既有 chunk 大小提示）。日志 `artifacts/festival-final-tests.log`、`artifacts/festival-final-build.log`。最终构建在所有生产文件冻结后完成；构建与读取 dist 的浏览器验收串行。

生产 GPU 切换已验证 39 个场景，41 个 WebGL 上下文全部释放，live=0，页面错误及外部请求均为空。报告 `artifacts/cozy-scenes/festival-four/report.json`。四个新场景在 390/320/1280px 通过 12 条键盘/恢复/提示流程、12 条实际网格拖点流程和 2 条还愿流程，共保存 100 张截图；页面错误及外部请求均为空。报告 `artifacts/festival-four-scenes/browser/report.json`，日志 `artifacts/festival-final-browser.log`。人工检查四张 390px 安放/悬起截图、两张 320px 写愿布局和两张 1280px 展示截图，未见溢出、悬空或布面穿插。全目录 39 个场景 × 3 种屏宽共 117 组布局检查全部通过：提示被动且处于画布内、没有横向溢出、退出无提示 DOM 泄漏；5 条既有物品操作流程也全部通过，页面错误为空。报告 `artifacts/object-first-scenes/browser/layout-report.json`、`artifacts/object-first-scenes/browser/report.json`，日志 `artifacts/festival-object-browser.log`。

独立只读审查针对 `41aa367` 之后的冻结变更，未发现 Critical 或 Important 问题，并独立运行四模块 100 项测试全部通过。其检查包括实际网格命中、遮挡、检查点、明确保存、暂停取消、恢复、资源释放与共享集成；浏览器视觉和移动导出由 root 另验。

## 文化来源与边界

各模块 README 记录本地卡、关联图片及核验的一手公开来源：包岑市政府与索布织屋博物馆（彩蛋）、巴斯克政府（太阳蓟）、法国文化部（节旗）、立陶宛国家 UNESCO 委员会与政府门户（草编）。照片只用于观察，没有复制为纹样或运行时贴图。草编关联广义 Baltic 卡，但明确选择立陶宛工艺，不泛称统一的波罗的海宗教。

所有操作为当代手作致敬：不模拟圣事、骑乘、朝圣领队、告解赦罪、洞穴祭仪或婚育礼仪，不承诺护佑效力。太阳蓟采用人工纸木花，不涉及野生植物采集。中央 UNESCO 页面遇到访问验证，草编完整文化依据改读国家委员会页面；索布资料 PDF 直读超时，已读市政府与博物馆页面，均在 README 如实说明。

## 移动端

在线 `npm run mobile:verify` 的 typecheck 通过，Expo 远程兼容检查仍提示既有五项补丁版本差异：`@expo/ui` 57.0.22→~57.0.23、`expo` 57.0.27→~57.0.28、`expo-dev-client` 57.0.19→~57.0.20、`expo-splash-screen` 57.0.9→~57.0.10、`expo-widgets` 57.0.23→~57.0.24。本批不混入依赖升级。日志 `artifacts/festival-mobile-online.log`。

最终 `EXPO_OFFLINE=1 npm run mobile:verify` 通过：typecheck、8 项 Node 回归、Android 与 iOS 的 native/DOM 导出均成功。两个平台各有 43 个 DOM 脚本与 12 个资产（13,466,736 字节），iOS 另核对 24 张 widget 封面。报告生成时间为 2026-10-13T05:35:19.606Z，输出目录 `apps/mobile-expo/.expo-export-check/verify-fqA9z5`；日志 `artifacts/festival-mobile-offline-final.log`，摘要 `artifacts/mobile-verification/latest.json`。离线检查使用锁定 SDK 的内置兼容表，不替代在线版本检查，也不是实体设备运行测试。

开发预览 http://127.0.0.1:5177/；生产预览 http://127.0.0.1:5178/。
