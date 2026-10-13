# Workshop four 实施与验收

设计：docs/superpowers/specs/2026-10-13-object-first-workshop-four-design.md。

## 上一批合并

用户明确要求提交、合并、推送后继续。Atelier已提交8c43e73；本轮复核和合并后分别运行完整测试，均成功（artifacts/atelier-merge-verification.log、artifacts/atelier-merged-master-tests.log）。合并提交6c0ba0fa51fa02742b4a1e0cc8cabc8f926bc484已推送origin/master，并以git ls-remote核对一致。本批从其上继续codex/object-first-workshop-four，完成后本地提交。

## 实现

- 铁线栖鸟：闭合铁线轮廓、开放鸟身与真实绕线握点。接合翅膀、完整小鸟落座、轻点静看。
- 花绣寄语：有厚度的亚麻绷圈、实际凸起线迹与线轴。添花、整圈入托、静看或明确提交。
- 釉彩映晴：九格原创花砖，带陶土厚度、釉面与砖缝。补齐中央砖、整幅入托、静看或明确提交。
- 彩车迎晴：有轮辐、贯通车轴、支撑架和开放车厢的彩木车。安装车轮、整车落垫、轻点静看。

四作者各自先记录空实现的公共行为失败，再实现物件。四模块专项测试最终163项（40/43/38/42）；只替换GPU边界，真实几何、射线、提示、表单仍参与。目录/每日分组/图标/地区卡/叙事/引擎/共享背景均已整合。应用层37项宿主生命周期测试通过。背景保持已批准的清透版本；没有新增背景装饰。

机构来源、访问受限页面及本地配图的区别详见各README。全部纹样为原创的当代公共工艺欣赏，地区索引不宣称其就是卡片中的宗教礼仪。

## 验证中发现的问题

51场景首次超过目录的两页上限（每页24条）。旧测试和浏览器脚本只展开一次，导致第三页的场景找不到；完整测试4项失败。确认SceneCatalog仍正确按24条递增后，将三处应用测试和三份浏览器脚本改为展开到目标或完整目录，并检查每页数量。三处测试修复后通过，产品分页逻辑未改动。原始失败记录artifacts/workshop-final-tests.log，针对验证artifacts/workshop-pagination-tests.log。

花砖初版测试误把已嵌入的中央砖当作第二阶段的无效来源；实际整幅所有不透明部分都应可拖。将无效来源改为工作垫，保留真实整幅操作。几何接触断言通过，未因此缩窄物件触摸面。

独立审查验证了三类问题，已全部修复：

- 外部进度/保存/反馈回调可同步暂停或销毁场景。补齐四模块的回调边界与末帧渲染防护，销毁后不再通知、反馈或渲染。明确保存若只是暂停，则保存与完成检查点仍同步提交一次；恢复不会重复写入。两个心愿模块曾因过早active检查跳过完成进度，新增恢复断言先RED后修正。花砖证据workshop-tile-review-red/green、workshop-tile-pause-red、workshop-tile-atomic-red/green日志；其余作者均记录先失败后通过。
- 花砖最初花瓣是零厚度面片，改为.0036厚度的小挤出，底部贴釉面；36片花瓣几何断言通过。
- 初版320px截图显示铁线散翼/鸟喙和彩车散轮/车辕越界。按宿主边框后的真实画布284×390、350×408投影每个顶点，各检查点0/1/2都验证。小鸟整体布局移向中央、模型和相机大小不变；彩车相机按长宽比拉开。独立审查的18项额外探针最终全部通过，记录于artifacts/workshop-review。

## 验收证据

初版诊断构建：artifacts/workshop-build.log。最终生产构建成功：artifacts/workshop-final-reviewed-build.log。固定输出artifacts/workshop-production-20261013-reviewed，预览http://127.0.0.1:5190/；浏览器读取此只读目录，不与移动导出或并行商店工作共用重建的dist。

在线移动核对typecheck成功，Expo保留五项既有补丁版本差异：@expo/ui57.0.22→~57.0.23、expo57.0.27→~57.0.28、expo-dev-client57.0.19→~57.0.20、expo-splash-screen57.0.9→~57.0.10、expo-widgets57.0.23→~57.0.24。未修改依赖，详见artifacts/workshop-mobile-online.log。

完整测试最终1,982项通过，木鱼资产检查通过（artifacts/workshop-final-reviewed-tests.log）；构建保留既有500KB chunk提示。固定生产index.html SHA256：`66c75be3a2b840e25ebf8500d532463f287be129c84b34b18e2571c1533e9c60`。

最终生产GPU检查通过：51场景，共53个上下文，释放53个，live=0，错误与外部请求均为0。报告artifacts/cozy-scenes/workshop-four-reviewed/report.json，日志artifacts/workshop-final-gpu.log。

最终EXPO_OFFLINE=1 npm run mobile:verify通过：typecheck、8项Node回归、Android/iOS native与DOM离线导出、55个DOM脚本、12个离线资产共13,466,736字节；iOS另核对24个widget封面。输出apps/mobile-expo/.expo-export-check/verify-dMLhJV，记录2026-10-13T09:23:44.900Z。固定报告artifacts/workshop-final-mobile-report.json，日志artifacts/workshop-final-mobile.log。这是离线SDK表校验和打包验证，不替代上述在线版本检查或真机运行。

独立只读审查覆盖四模块和共享整合。18项独立探针通过，并逐张检查最终320px小鸟/小车的0、2检查点截图，确认修复。无未解决问题。未另外复验远端资料或真机音效/触觉；本轮也未宣称真机验证。

最终生产浏览器验收通过：新四场景在390/320/1280px三屏宽共12条键盘/恢复/提示流程、12条真实可见物件拖动流程、2条返回心愿流程，100张截图，无页面错误和外部请求。固定报告artifacts/workshop-final-browser-report.json，日志artifacts/workshop-final-browser.log。全51场景三屏宽共153项布局检查与5条既有物件流程通过，固定报告artifacts/workshop-final-layout-report.json、artifacts/workshop-final-object-report.json，日志artifacts/workshop-final-layout.log。

主审逐张查看最终生产390px的四张object-2截图（artifacts/workshop-four-scenes/browser/{slovak-wire-bird,hungarian-embroidery-hoop,andalusian-ceramic-tile,sicilian-painted-cart}-390-object-2.png）：主体完整，手工物件轮廓可辨，背景清透且保持低细节。结合独立审查的320px截图，接受最终效果。提交前再次校验artifacts/workshop-source-sha256.json中的全部源码哈希，与最终测试和构建时完全一致。

## 工作区边界

并行App Store发布文档、截图/上传脚本、内容权利资料、Notion法律页、商店配置、assets/README.md、package.json、legal-content.ts均保持原样并排除提交。精确清单见artifacts/workshop-owned-files.json；不会git add整个工作区。

## 自动合并补记（2026-10-13）

用户随后明确授权定时自动提交、合并、推送。workshop 提交 `5a169d1` 已通过合并前后各 1,982 项测试，于首次心跳合并为 `cdba0de4df41f7710faed7047148dc7c50f2d627` 并推送 origin/master；远端 SHA 已核对。合并树与本批已验收提交一致，62 个并行文件内容未变化。证据：`artifacts/automation-workshop-20261013/merge-report.json`。后续四个旧场景的回调生命周期修复与续接位置见 `2026-10-13-atelier-callback-lifecycle.md`。
