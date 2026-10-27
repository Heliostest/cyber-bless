# 八语言 i18n 验收记录

日期：2026-10-27。对应用户批准的 [设计](../superpowers/specs/2026-10-27-i18n-design.md) 和 [实施计划](../superpowers/plans/2026-10-27-i18n.md)。状态：实现与本地可执行验收完成。原生真机、人工语言审校与性能验证的边界分别列出，未用“完美”替代证据。

## 已实施

纯 JS FormatJS 基础包覆盖八语言离线词表、稳定 ID、ICU 参数类型、语言匹配、区域格式、系统时钟偏好、Unicode 字素工具与源语义错误。App 包含保存偏好、早期启动、语言选择、HTML lang/title、可信显示入口、系统事件适配。命令式场景通过显式绑定重绘现有实例，保留进度与用户原文。Native／Widget 使用同源生成资源与严格公开快照 v2，并兼容已校验的 v1。

修改基于现有脏工作区，保留已有心愿、商店和截图改动；没有提交、推送、上传或发行。

## 词表与审阅范围

八语言均包含 App 440、场景短文 2,209、介绍 154、原生 9、通用 ICU 25、视觉控制 23、开发入口 70，共每语言 **2,930 条**，八份合计 23,440 条。154 个场景介绍按原有双段结构完整翻译，未把来源仓库 1,600 份研究卡假算为运行时翻译。

技术检查包括分组／ID 一致性、空值、重复 JSON ID、ICU 解析、变量名／显式类型、select／plural 结构与精确数值分支、目标语言复数类别、标签、介绍段落、生成物及审阅 hash。翻译由各工作者按源文自审；繁体在 OpenCC 草稿基础上复核 UI 用语并修改 56 条（快取、裝置、設定、儲存等），保留手工场景译名；法语 11 条短文、6 篇介绍的显式结束按钮引用统一为 Terminer。法／葡各 11 条、西语 18 条现有复数消息显式声明 many，使用同一目标语言已译好的复数词形，不改变日常显示。此范围不等于八语言母语者审校。

文化语义沿用既有来源审计；翻译不新增传统主张。hiiragi 器物名称错误另按直接来源修正并记录在 [场景实施记录](2026-10-27-i18n-scene-implementation.md)。不能把文化安全等同于技术测试通过。

## 当前验证证据

- `npm.cmd test` 全仓库通过：core 73、runtime 12、App 1,133、gestures 55、shared 3、scenes 9,427、content 37、scene-runtime 142；包括场景 TypeScript 与木鱼资产完整性检查。日志：`artifacts/i18n-final-tests.log`。后续排版修改按受影响套件补测，不虚构新的全量 run。
- i18n 最终定向 22/22；ICU／分组／复数验证器 9/9；提取器反例 11/11。包含 UTF-16／IME、旧异步宿主越权覆盖 locale、prop-only 系统时钟切换、对象原型 ID 等回归。
- [独立代码复核](2026-10-27-i18n-independent-review.md)：原六组 UI P2 与后续两组门禁 P2 均已关闭，无剩余确定性实质缺陷。涵盖搜索、现有木鱼语言更新、错误分类、Unicode fallback、IME、遗漏入口、目标独有分组与复数分支。
- 真正八语言排版矩阵：661 cases／50 screenshots 通过（`artifacts/i18n-layout-final-expanded/report.json`）；另有视口缩短与字体失败 40 cases／20 screenshots 通过。人工检查发现计数胶囊 `6…` 是原断言遗漏，已增加宽度断言并将计数改为完整可见的普通流，八语言三视图及字体失败复查 32 cases／12 screenshots 通过（`artifacts/i18n-layout-world-counter-final/report.json`）。移除重复读屏名词，Hans/Hant 完整“件珍藏”现在可见。
- 最后将四个导航的可见短标签与完整 ARIA 名称分别处理，例如 Jour／Aujourd’hui、World／Little World、世界／小さな世界。定向 App 行为测试通过；最终 32-case 几何复查全部通过（`artifacts/i18n-layout-final-dock/report.json`）：八语言标签最多两行、44px 以上目标、所有按钮中心可点击、完整读屏名称与计数无省略。案例有重叠复查，不能相加称为不同功能数。
- 开发画廊与真实短册场景：FR／JA 的 320px／200% 四案例通过；切换到英文再切回时保留 canvas、按钮及已完成 checkpoint（`artifacts/dev-i18n-layout/report.json`）。
- `npm.cmd run build` 通过完整原文提取／词表／审阅 hash／生成物／类型门禁与生产构建。最终提取器扫描 538 TS/TSX 文件、3,289 个登记字面量位置、8 个精确豁免，并列出 493 个动态表达式，不能据此保证所有动态值的语义。
- `npm.cmd run mobile:verify` 通过：依赖一致、8 项引导／资源安全测试、实际 Android 与 iOS JS／DOM 离线导出，14 个本地资源与 465 个 widget cover hash 验证。小组件 21 项插件／Babel／隔离渲染测试最终复跑通过；早期 Android Kotlin 编译／单元测试见 [Native 记录](2026-10-27-i18n-native-implementation.md)。iOS JS 导出不等于 Xcode 编译。

全量八语言 AST 当前随包离线加载，Web 主入口约 5.46 MB（gzip 1.70 MB）；构建保留 chunk 大小提示。未在本轮冒称已完成低端设备启动性能测试，或用提高 warning 阈值隐藏这项成本。

## 来源规范核查

- 本轮不改器物、动作、节期、数量规则、技术 ID 或引擎版本；文化语义沿用既有逐项审阅，翻译不能反过来充当传统证据。
- 铭文“念／五／大／力／運”保持对象原字；译解释和无障碍标签，不把原物文字变成另一语言的图案。
- hiiragi 名称纠正的直接已读来源、支持范围和访问状态见场景记录；同步来源卡、README 与译名，未编造替代文化背景。
- 已查目录／注册表／metadata 与原生生成标题的一致性；全场景技术测试通过。这只证明实现一致，八语言措辞仍是明确记录的 agent 自审，不能冒称母语文化专家审阅。

## 平台与人工验证边界

Windows 环境无法执行 iOS Xcode 编译和设备安装。未宣称已完成 iOS／Android 真机字体、原生大字、软键盘、VoiceOver／TalkBack、App 关闭后的系统重绘验收。Chromium 模拟、生成插件测试和 JVM 测试不能替代这些结果。没有请求用户重复批准实现，也没有为这些验证边界擅自上传发行。

未知远端旧协议没有 sourceLocale；保持其原文并用 `lang="und"` 表示未知，不能猜测目标语言或自动翻译个人／远端内容。
