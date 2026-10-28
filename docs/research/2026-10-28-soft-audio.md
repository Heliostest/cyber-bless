# 轻柔结果音与操作音

日期：2026-10-28（Asia/Shanghai）。用户授权按音效审计顺序实现：完成、收下、保存成功，然后木鱼、折纸与倒水等操作；风格轻柔可爱，服从现有开关。

## 实际实现

- `packages/shared/src/soft-audio.ts` 提供 complete、collect、saved、woodfish、paper、water、woodTap、beans 八种本地合成音。结果音使用短旋律，操作音用本地 PCM、柔化噪声与短共鸣，不下载录音、不增加依赖。
- App 中新进度首次达到场景完成条件时播放完成音，九步供水与十二次木鱼沿用各自阈值。新手收下与纪念物飞行播放收下音。心愿创建、记录心情、确认实现和还愿的保存提示等宿主实际写入成功再播放；失败、幂等动作、加载与恢复不触发成功音。
- 木鱼接触采用木质共鸣，仍优先播放内容包提供的音频。木鱼声音与结果音拥有独立节点，局部暂停／离开只停止木鱼尾音，不截断完成或收下反馈；保留原完成震动。
- 纸鹤每次接受折叠时播放短纸张摩擦；清水七供、浇水敬老、泉水净币在可见水流出现时播放水声；开樽祝愿在叩盖时轻碰；节分撒豆在散落阶段播放颗粒声。鱼生捞起保留原步骤音，只接入统一停止生命周期，没有添加与实际物体不符的水声。
- 现有声音开关活读，静音、暂停、失焦、后台、销毁取消排程；恢复不补播。结果与操作音分别受并发、强度、时长上限约束，并回收自有节点；未支持的音频宿主安静降级。已有音效开关、震动与视觉风格菜单继续使用原存档。

设计与执行记录：[设计](../superpowers/specs/2026-10-28-soft-audio-design.md)、[计划](../superpowers/plans/2026-10-28-soft-audio.md)。

## 文化影响审阅

本次核对实际动作与时机后，仅添加产品合成拟声与结果反馈，不改变器物、材料身份、操作顺序、次数、结束条件、文案、含义或来源归属。声音不作为现场录音、传统音色、曲调或仪式复原呈现，不新增文化事实；无需补造文化证据。

沿用[现行核查规范](../scene-provenance.md)、[全场景核查](2026-10-19-scene-culture-audit.md)与各场景 README 的既有支持范围。七个受影响场景 README 追加本轮技术与产品表达边界。木鱼宿主实现、注册表、来源卡、模块 metadata 和原生标题均未涉及来源或可见内容变化，保持原值。音效与交互测试用于检查实现，不替代文化证据。

- [x] 核对实际物体、动作及完成条件；不把产品拟声反向当作传统事实。
- [x] 无新文化主张、来源错绑、寓意规则、身份或期限变化。
- [x] README 区分合成产品反馈与文化来源；不登记未访问的外部正文。
- [x] 技术 ID、引擎、存档、可见范围、来源 slug、模块及原生标题保持一致。
- [x] 不新增效力承诺、宗教解释或操作要求。
- [x] 最终技术验证记录见下，失败项如实列出；未把全仓检查登记为通过。

## 验证

测试先观察缺失行为失败再实现。新增共享合成器 25 项、App 结果与木鱼生命周期 13 项、场景操作音 30 项，共 68 项音效行为测试；另保留原场景 helper 回归。

真实 Edge 浏览器通过纸鹤、七碗、净币、叩盖、撒豆五个场景的辅助操作与实时静音；水声在倒水检查点结算前启动，初始恢复静默，无页面错误。使用真实 OfflineAudioContext 将八种音效渲染为 WAV，检查信号非空、低峰值及无削波，试听文件保存在 `artifacts/soft-audio/`。此项验证浏览器的调度与渲染，不声称已验收实体手机扬声器或耳机听感。

独立审阅发现并修复两项：旧仪式完成时震动遗漏；木鱼局部暂停未停止尾音。复审与对应 13 项回归通过。

最终验证结果：

| 检查 | 结果及日志（仓库根目录相对路径） |
| --- | --- |
| 共享包 | 28/28 通过，含 25 项新合成器测试；`artifacts/soft-audio/shared-test.log` |
| App 音效与木鱼生命周期 | 本轮新增 13 项与独立复审通过；并行工作扩展反馈 API 后收尾重跑为 14/14 通过，`artifacts/soft-audio/app-audio-final.log` |
| 操作音与原 helper | 37/37 通过，含 30 项新测试；`artifacts/soft-audio/operations-final.log` |
| 浏览器与八种 WAV | 5 场景、实时静音和恢复静默通过，无页面错误；`artifacts/soft-audio/browser-report.json`、`listen.html`、`preview.wav` |
| TypeScript/Vite 生产代码构建 | 最新实现通过，有既有 chunk 体积提示；`artifacts/soft-audio/production-build-final.log` |
| 原生移动端 TypeScript | 通过；`artifacts/soft-audio/mobile-typecheck.log` |
| 其余完整包 | i18n、core、runtime、gestures、content、scene-runtime 均通过，木鱼资产检查通过；`artifacts/soft-audio/` 对应日志 |
| 根 `npm test` | 在 App 的 `hourly-scene-lifecycle.test.ts` 17 项拖放／暂停后推进断言失败时终止；之后最新版 App 完整补跑为 1160 通过、17 失败；`root-test.log`、`app-final-test.log` |
| 场景完整包补跑 | 已见多处空间摆放／进度断言失败，完整运行中止，不能登记全包通过；`artifacts/soft-audio/scenes-test.log`。本轮音效专项 37 项独立全绿 |
| 根 `npm run build` | 首次完整通过。收尾复跑被并行新增 `placement-inspection.ts:8/:19` 两条提示未登记 i18n 阻断；`build-final.log`。随后最新 TypeScript/Vite 生产代码构建独立通过 |

运行中工作区另有持续的拖放／空间摆放修改。早期场景套件不是一致快照，已停止，其记录在 `artifacts/operation-audio/early-scenes.log`。独立归因用内存 pre-transform 替换旧 HEAD 音频 helper，不覆盖共享源码：`brat-bride-cloth` 在当前与旧 helper 下均期望 1、实际 3；`thai-songkran-elders` 均期望 1、实际 2。旧 helper 对新接口仅添加 no-op 兼容，不改变场景。验证前后共享源码 SHA256 相同。完整证据在 `artifacts/soft-audio-attribution/summary.json`；未在本任务改动这些无关交互。

后续用户授权修复上述拖放与翻译登记问题。现在根 `npm test` 全部 11,608 项通过、零失败／跳过，根 `npm run build`（含 i18n、TypeScript 与 Vite）退出 0。上表异常保留为音效阶段历史，已不代表当前整仓状态；修复范围和最终日志见[全量恢复记录](2026-10-28-drag-test-recovery.md)。
