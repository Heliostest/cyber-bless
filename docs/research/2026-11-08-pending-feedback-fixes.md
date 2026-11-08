# 三条待处理反馈：转看方向与窗布铺展

核查日期：2026-11-08。场景：`brat-bride-cloth`、`korean-sotdae` 及共用近景查看的场景。

## 实际问题与实现边界

| 反馈 ID | 原问题 | 修改 |
| --- | --- | --- |
| 4829379d-ceb0-42d8-9030-45571c1b9a13 | 鸟竿拿近后物品旋转与拖动预期相反，其他查看场景也可能受影响 | 共享控制绕相机而非转物体，水平轨道增量反向；上下方向键对齐屏幕拖动语义。实体物件不改器形或动作。 |
| 4631704c-2b8d-4b57-8c12-ee4dff276a7e | 窗布拿近看看缺少可看内容 | 本场移除独立查看，直接拿放。 |
| a52a86ff-2e8e-4609-a7cb-8cdb9d839de0 | 铺布希望拉近，并需要用户左右抹平布料 | 落定进入近景；局部压力降低褶皱静止高度，耦合阻尼弹簧更新布面。只在足够区域铺展并松手后完成，辅助按钮可分阶段等价操作。 |

窗布实际仍为原创素面蓝绿布、浅色布边、封闭上下表面、木凳、石木窗框与户外窗台。拿放后新增铺展；没有折编、擦身、浸井、系树、治疗、圣人显现或过夜倒计时。移除查看不改变原有民俗信仰背景。抹平和阈值不是传统步骤或宗教完成条件。

## 本次受影响主张的直接核查

| 主张 | 来源与相关位置 | 实际读取状态 | 支持范围与不能外推的内容 |
| --- | --- | --- | --- |
| 节前夜将布或缎带留在住宅外窗台或门边，盼圣人触碰赐福，有护佑和求愈信念 | [St Brigid’s Day，National Museum of Ireland，Clodagh Doyle](https://www.museum.ie/en-IE/Collections-Research/Folklife-Collections/Folklife-Collections-List-%281%29/Religion-and-Calendar-Customs/St-Brigid-s-Day)，「Spring and protecting the farm and home」，L71、75、79；署名L93 | 2026-11-08 已实际读相关网页正文；精确发布日期未见，不以版权年代替 | 机构策展综述，支持所述留布语境；不支持统一布形/颜色/纤维、屏幕抹平、覆盖量、手势方向、次数、疗效承诺或应用祝福生效。 |
| Brat Bríde 的留布与保护、求愈信念，以及 Ballyduff 的地方记载 | [St Brigid’s Day，Dúchas 教学 PDF](https://www.duchas.ie/assets/pdf/duchas.ie-1-february-st-brigid-s-day.pdf)，8 页中的第 6–7 页（零基5、6），Brat Bríde 段落与 Ballyduff, Waterford 引文 | 2026-11-08 已读提取的相关正文，未读照片像素或手稿扫描 | 支持留布、信念与地方性；不能外推全国统一做法，也不能推出抹平操作。 |
| 其他既有地方细节 | [2026-10-23 研究](2026-10-23-brat-bride-cloth.md)中 Schools’ Collection 卷0654页92的记录 | 本次未重访，保留原记录的访问差异和未读扫描限制 | 沿用既有有限支持，不把本次已读状态扩展到该来源。 |

传统事实与产品新增分别见[专卡](../../content/traditions/brat-bride-cloth.md)与[场景 README](../../packages/scenes/src/brat-bride-cloth/README.md)。来源保持 `brat-bride-cloth`；不新建来源卡，不借用其他宗教或地区索引。

共享转看只修复输入映射；其他场景的器物、材料、操作阶段、信仰语境、文案、来源、完成条件均未新增。沿用各场景 README 已有核查，不将外链登记为重读。对应场景由 `createCloseInspection` 的实际调用枚举，README 补充本次技术变更说明。

宿主 `daily-scenes.ts` 继续引用同一 ID 与动态叙述；注册表和模块 metadata 的 `brat-bride-cloth` 来源绑定不变。宿主介绍和 intention 改为拿放与抹平，八语言目录同步。原生组件标题未变，无须重命名。引擎 `brat-bride-cloth@1`、`korean-sotdae@1` 和整数存档保持兼容；测试指纹另行重建。

## 核查清单与验证

- [x] 按实际器物、场合、动作和完成条件核对，并区分产品表达。
- [x] 本次受影响的文化主张有直接已读正文；无新增抹平传统或疗效断言。
- [x] 专卡直接对应留布实践，没有地区索引错绑；真实信仰背景保持。
- [x] 形制、近景、手势、覆盖量与物理解算均明确为产品安排。
- [x] 专卡、研究、README、宿主说明、多语言和技术身份一致。
- [x] 技术测试和浏览器验证单独记录；技术通过不作为文化证据。

技术日志与截图存于忽略目录 `artifacts/test-feedback/`：

- 最终完整 `npm test` 退出 0；其中场景层 303 个测试文件、10,781 项测试通过，App 层 1,708 项通过。完整日志为 `pending-fixes-full-test-final.log`。先前沙箱运行因本机 HTTP 被阻止而没有登记为完整通过；最终整套在允许 loopback 的环境运行。
- `npm run build` 退出 0，包含八语言抽取、目录/审阅记录及生成检查。保留既有 bundle 大小提示，不登记为无警告构建。
- 移动端 TypeScript 检查退出 0；启动桥、离线嵌入与内部工具 10 项通过。没有执行原生编译、TestFlight 上传或新安装包发布。
- 158 个场景测试指纹重建并校验通过；`git diff --check` 通过。共享控制的实际 15 个消费者获得新指纹，窗布按新流程重建。
- Chromium 实际触摸模拟在 440px、减少动态 320px，及鼠标 1280px 均完成拿放→近景→抹平；真实 position buffer 变化，提前安放无完成、抹平后保存 3，无 pageerror。鸟竿在 440px 触摸下，前表面世界点的屏幕投影在上下左右四个方向均随手指同向。回执为 `pending-fixes-browser.json`、`pending-fixes-rotation-browser.json`；截图为 `cloth-close-*.png`、`cloth-smoothed-*.png`、`sotdae-turn-direction.png`。这是浏览器输入模拟，不称为 iPhone 真机验证。
- 独立代码审阅发现 body 焦点下 Escape 无法取消、完成存档重开恢复旧褶皱两项；分别补充失败回归后修正，再次审阅确认关闭。窗布 39 项场景测试覆盖取消与最终布面一致性；旧网格拓扑、接触、穿透和 buffer 复用测试继续通过。
- 2026-11-08 17:48（上海）将上述三条反馈且仅这三条标记 `fixed`，随后读取确认。后台仍共 11 条记录，待处理为 0、无损坏收件；小型状态回执为 `pending-fixes-status-receipt.json`。标记修复不等于已发布或测试人员已在新版真机复测。

修复验收使用本地 `codex/fix-pending-feedback` 分支。验收完成后用户另行授权提交、合并并推送至 `master`；本轮不创建发布 tag 或发布安装包，后续真机复测需包含本次修复的新包。
