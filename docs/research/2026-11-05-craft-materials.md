# 首批四场器物表面增强

核查日期：2026-11-05。用户确认四场首批对比；实际阅读 scene.ts、材质转换器、四场 README、对应来源卡及其既有核查入口后实施。共享入口为 `@wbr/scene-runtime/craft-surfaces`。

## 实际呈现与文化影响

| 场景/最终来源 slug | 实际材料与受影响部件 | 本次变化与支持范围 | 既有证据记录与读取状态 |
| --- | --- | --- | --- |
| `ema-votive-plaque` | 木牌、木架、悬绳；翻面、书愿/留白、悬挂和感谢 | 木纹、端面环纹、纤维；不指定木种/工序，原创花叶保留 | [来源卡](../../content/traditions/ema-votive-plaque.md)、[B 组核查](2026-10-20-scene-narratives-b.md#ema-votive-plaque)。本次已读本地卡/场景，外链沿用原记录，未重新访问。 |
| `barcelos-clay-rooster` | 彩绘陶鸡深色主体/红部、陶色碟与台缘；添彩、移台和静看 | 微颗粒、宽柔高光；不新增陶釉/烧制技法主张，不改变原创彩纹 | [来源卡](../../content/traditions/barcelos-clay-rooster.md)、[A 组核查](2026-10-20-scene-narratives-a.md#barcelos-clay-rooster)。本次已读本地卡/场景；市政府页既有失访仍为失访，未登记为重新阅读。 |
| `shrine-suzu-bell` | 金属裂口铃、金属悬环/内部、木架、三股实体绳；轻拉/收回/礼敬 | 恢复原本被卡通转换压平的金属反光，微粗糙变化、木纹、纤维；不指定合金、镀金或编织技法 | [来源卡](../../content/traditions/shrine-suzu-bell.md)、[C 组核查](2026-10-20-scene-narratives-c.md#shrine-suzu-bell)。本次已读本地卡/场景，沿用参拜金属铃与宗教语境的记录，未重新访问外链。 |
| `omamori-cycle` | 三色封闭守袋、缝口、绳结和桌面；选袋、随身/感谢返还、静候 | 低强度织纹与纤维、桌面木纹；不表示某种特定织法/纤维/产地，不增加内部内容 | [来源卡](../../content/traditions/omamori-cycle.md)、[B 组核查](2026-10-20-scene-narratives-b.md#omamori-cycle)。本次已读本地卡/场景；神佛守护、感谢返还及期限差异沿用既有核查，未重新访问外链。 |

传统事实继续以各专卡原有证据的有限范围成立。新增纹理、反光和强度完全属于产品美术；这次没有新增地域、起源、寓意、顺序、期限、数量、资格或功效主张，也没有把真实信仰语境改写为装饰/自省。无需为这些技术参数另造传统背景。

## 实现与边界

- `createCraftMaterial` 明确区分 wood、ceramic、metal、fabric、cord。局部坐标纹理不依赖 UV，随原几何移动；木架竖柱使用竖向木纹。
- 程序噪声、滤波周期纹、微法线和粗糙度共同表达细节。高频按导数估计的像素足迹衰减，避免远景/小屏幕过密。没有位移几何、外部纹理、独立动画循环、透射或附加渲染目标。
- 陶面与金属在柔和卡通中保留 Standard 的宽高光；木、布、绳仍为卡通面。墨线模式继续采用硬卡通，保留程序表面。所有模式恢复相同源材质；现有纸布光学补丁不变。
- 各场仍通过 `disposeTree` 释放源材质，风格适配器只释放自有克隆；程序补丁不持有 GPU 纹理。动画颜色、发光及粗糙度仍从源材质同步。
- 四场标题、宿主目录/注册表/module metadata 的来源字段、原生标题、技术 ID、引擎版本和存档保持；仅刷新测试修订索引。来源身份逐场一致，无须解除关联或改为 product-original。

## 验证

实际浏览器检查脚本：`scripts/verify-craft-surfaces-webgl.mjs`。先运行 `npm.cmd run dev -w @wbr/cyber-bless -- --host 127.0.0.1 --port 5184 --strictPort`，再运行该脚本。可通过 `WBR_URL`、`CRAFT_OUT` 和 `CRAFT_BROWSER_PATH` 选择服务、产物与浏览器。

本地前后对比、截图、源码哈希及 JSON 回执位于 `artifacts/material-assessment/verified/`；完整测试日志位于 `artifacts/material-assessment/full-test.log`。浏览器使用桌面 Chromium/SwiftShader，不能作为手机 GPU 性能或真机 WebView 验收。白天使用实际场景与共享布景；夜间在实际场景的 object presentation 宿主验证 `addStageLights` 原有夜间灯组，避免按场景 ID 固定的白天布景覆盖它；暗光球另作独立材质探针，未改造四场的生产夜间布景。

已完成的技术检查：

- 最终固定源码 WebGL：五类材质 × 白天/暗光 × 五风格，共 50 次探针渲染；四场 36 个实际状态 × 四风格，共 144 次场景渲染（含 320/390 的原有夜间灯组及 640 对比图）。合计 194 次，无 console/page/shader 错误，无风格回退或空/黑帧。36 次挂载均核对精确源材质恢复、暂停/继续、无额外进度回调、每个源 craft 材质仅释放一次及退出移除风格注册。起止源码哈希一致。已人工查看四场前后拼图、320/390 的木牌/御守及夜间铃截图。

- 完整测试链中的 i18n/core/runtime/app/gestures/shared/scenes/content 共 12,651 项通过，其中 scenes 为 296 文件、10,765 项。随后运行到正在新增的五类 raw-height RED 回归时按预期失败；这些失败分别为 wood/ceramic/metal/fabric/cord 的 “keeps the … height field free of derivatives before evaluating its gradient”。修复后最终 scene-runtime 全套 18 文件、260 项通过（`runtime-final.log`），合计所有工作区 12,911 项通过。
- 其余完整测试链：i18n 脚本 20 项通过；打包资产与反馈脚本最终 29 项、修订生成器 11 项通过；木鱼资产核验通过。第一次脚本检查的 `terminal log reader follows rotation even when the replacement is longer than the old file` 因沙箱拒绝临时文件重命名而失败，在受控本机环境复跑后通过，未改测试或反馈服务。
- 最终生产构建、i18n 校验通过；Vite 仍报告大于 500 kB 的 chunk 提示（`build-final.log`）。本次没有新增依赖或外部运行时素材。
- 用户要求提交、合并和推送后，对固定最终源码重新执行完整 `npm test`，单次完整链通过（`pre-merge-test.log`）；同时核对 WebGL 回执的八个源码哈希与提交内容一致。
- 独立只读审阅检查 shader 组合/缓存、坐标滤波、动画同步、数组恢复、资源所有权和文化材料边界。提出的高阶导数与夜间漏验均已修正；后续复核无未修复实质问题。

首轮真实驱动检测发现着色补丁与 Three 的 `#define STANDARD` 之间缺换行；新增失败回归后修复。这也说明字符串补丁单元测试不能替代实际 WebGL 编译。首次木纹画面对比还暴露过宽规则条带，已收窄为细、不均匀、低浮雕的深浅纹。

独立审阅还确认了高阶导数风险：颜色滤波与浮雕原始高度场已分离，高度导数在条件早退之前计算，再在梯度外施加像素足迹权重。技术依据为实际阅读的 [Khronos OpenGL Refpages `dFdx.xml`](https://raw.githubusercontent.com/KhronosGroup/OpenGL-Refpages/main/gl4/dFdx.xml) Description 中第 94–100 行（2026-11-05 已读）；该段说明高阶/混合阶及非一致控制流导数的未定义结果。它是技术依据，与文化事实无关。最终 WebGL 验收另核对起止源码哈希一致，防止中途改源码导致回执身份不符。

## 核查清单

- [x] 实际材料、部件、动作、对象与完成条件已对照，未由外观反推传统。
- [x] 材料身份不变，新增美术参数不作文化事实；已引用既有核查并注明本轮外链状态。
- [x] 复用四张对应专卡，无地域索引式错绑；宗教/工艺背景保持原有范围。
- [x] 无新增寓意、期限、起源、规则或功效；来源卡与 README 已记录产品表达。
- [x] 来源身份、标题、metadata、注册表与存档保持一致；无必要的原生标题变更。
- [x] 提示、介绍、状态和结束语继续对应原交互，没有新增文化文字。
- [x] 最终测试、构建、实际显示及资源退出结果已填入；技术结果与文化审阅分开报告。
