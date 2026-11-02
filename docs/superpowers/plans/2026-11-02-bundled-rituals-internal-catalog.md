# 实施计划

规格：[仪式随包发布与内测目录](../specs/2026-11-02-bundled-rituals-internal-catalog.md)。在用户指定的主工作区实施，保留并行画风修改；变更基线已保存到忽略目录 .superpowers/sdd/bundled-rituals-internal-catalog/baseline.patch。

1. 内测入口：BlessingApp 新增默认 false 的 internalToolsEnabled，Context 中同名可选字段；隐藏正式版菜单并拦截初始/直接路由。Web DEV 打开；原生壳检测 TestFlight 再通过 DOM 属性传入，缺少原生能力时关闭。移除宿主远程目录环境配置及面向用户的缓存入口。增加发行环境与导航回归测试。
2. 内置资源：场景库只用内置目录，忽略旧远程入口并按技术 ID 解析内置条目。木鱼客户端始终使用随包资源，旧缓存不能替换当前模型；把当前提供的模型纳入离线清单。目录所有条目标注内置并取消下载管理。覆盖旧远程配置/存档/缓存的离线回归测试，保留通用底层内容工具的独立兼容性。
3. 完成解锁：核心持久化 unlockedSceneIds（兼容可选旧字段），导出 isSceneUnlocked(State, id)；完成即记录、迁移旧完成及领取记录。玩家愿望仪式选择改用该 helper，目录不受玩家解锁限制。验证完成未领取、恢复、重玩、进度重置及旧档。
4. 集成：主代理统一更新 app 域多语言和相关决策文档；运行 core/app/content 测试、i18n 校验、Web 构建与 mobile:verify。独立审阅最终改动并解决问题。打开调试页面停在“我的 → 场景目录”，浏览器核对目录和内置标签。

文件边界：任务 1 拥有 App/context/pages 和原生壳；任务 2 拥有 scene-library/content/scene-experience 和资源脚本；任务 3 拥有 core/index、vessels、WishRitualPicker；主代理拥有多语言生成及文档。共享接口仅 internalToolsEnabled 与 isSceneUnlocked。各代理不修改其他任务文件或生成全局多语言文件。

## 实施与验收（2026-11-02）

全部任务已实施，原有画风修改一并保留并完成独立审阅。以下记录实现阶段的验收结果，提交与合并状态以 Git 历史为准。

- core 167 项、App 1358 项/49 文件、content 37 项通过；i18n 22 项及 Node 20 项通过，八语言 i18n:verify 通过。
- 资源打包回归 2 项通过，使用 EAS CLI 实际忽略规则确认所有离线源资源可上传；生成的双宿主清单与木鱼模型哈希一致。
- 最终 npm run build 通过；仍有既有大 chunk 提示。
- mobile:verify 通过：类型、Expo 版本对齐、12 项 Node 检查及双端 native/DOM JS/HTML/CSS 导出；每端 171 项离线资源哈希，iOS 477 个小组件封面校验通过。
- Expo Apple autolinking 能识别 blessing-runtime。Windows 未编译 Swift、未验证 TestFlight/App Store 真机；需下一次原生构建实机验收。检测失败关闭内测入口但不阻塞游玩。
- 浏览器 localhost:5176 已停在“我的 → 场景目录”，显示“91 个场景 · 全部内置”，未显示下载/缓存管理入口。截图：artifacts/ui-review/bundled-catalog-2026-11-02.jpg。

修复的集成问题：旧记录作为路由入口时，进度变化不再重复挂载场景；App 标题和引擎按稳定 ID 取内置条目；EAS 原有仅保留旧模型的白名单改为当前模型。完整场景几何测试未重复运行，因为本次未修改场景器物/操作实现或文化主张。
