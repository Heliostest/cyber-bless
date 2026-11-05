# 调试台双树木来源接入

本文保留最初来源接入的交付记录。用户随后选择特色树形统一为 Just a simple tree，并要求近景树下构图；当前布局见[树下构图](2026-11-05-under-tree-preview.md)，下文保留原位置／世界高度的说明是初版行为。

日期：2026-11-05。用户选择同时接入 Quaternius Stylized Nature MegaKit 与 Just a simple tree，要求在现有调试台选择。

## 实际交付

- 开发版「调试台 → 树木样式」提供原有树木、Quaternius Stylized Nature、Just a simple tree；对当前真实 App 作用域内的场景生效，不写正式存档或视觉偏好。折叠面板保留，恢复按钮或控制台卸载恢复原树。
- 共享日景与夜景背景树按既有位置、朝向和世界高度实例化。日景沿用 KayKit 默认；夜景按 Kenney 原几何高度换算，避免替换后缩小。没有背景树的海岸与对象展示不提供选择，主题菩提树、许愿树等器物不替换。
- 每套两棵真实来源树，共四个自包含 GLB，合计 2,020,940 字节，随 Web 与 Expo public 离线打包。只在选中后加载；正常构建直接复制产物，不需要运行生成器。两套来源都没有新增 npm 依赖。
- 加载保留旧画面，成功后整体替换；失败恢复原树并显示状态。逐个登记已到达资源，取消立即释放，迟到资源自行释放；一个变体失败不会等待另一项卡住。保留源法线、叶片 alpha-mask、UV 和顶点色，重复模型用 InstancedMesh；叶片投影但不接收密集叶卡自阴影，源配色保留。宿主只有轻微叶冠摆动，遵守暂停及减少动态效果；没有引入源编辑器的完整风、季节或 LOD。

## 来源、许可证与文化范围

来源正文、读取状态、精确 SHA、原件和转换差异分别在 [Quaternius README](../../assets/environments/trees/quaternius/README.md) 与 [Just README](../../assets/environments/trees/simple-tree/README.md)。Quaternius 为作者免费 Standard 的 CommonTree_1／CommonTree_5，CC0，未购买 Source 或获取付费 shader。Just 固定作者提交 `8fd94b8edc7ef1b87c086694382a0808c059971c`，MIT，仅离线运行 CPU 生成路径，不带音乐音效。

已阅读[场景来源规范](../scene-provenance.md)。实际变化是通用背景树几何、纹理和调试控制；场景器物、动作、对象、场合、完成条件、标题、文字、寓意和文化来源字段均不变。模型类型不作为传统植物身份或文化事实依据，不新增地域、历史、宗教或 Tiny Glade 素材归属主张。来源卡、宿主 traditionSlug、注册表和模块 metadata 无需改绑；技术 ID、引擎版本和存档格式保留。

核查清单：实际背景树与主题器物边界已审阅；无新增文化主张或错误来源绑定；资源授权与文化证据分开；两套源记录明确产品适配与读取状态；本次文化字段同步不适用。八语言调试文案完成代理自审、完整性和 ICU 校验，不声称母语认证。

## 验证记录

- 两个 prepare 脚本 `--check` 均通过：核对原始文件哈希与许可、离线确定性字节重建；Just 还通过 Three r170 再导入检查法线／叶卡／AO／纹理；Quaternius 通过真实加载器、贴图色彩空间与源属性对照。
- 单元测试覆盖 App 作用域、折叠与恢复、日夜真实高度、失败／卡住／过期加载、逐项释放、原始透明裁剪属性和保留场景会话。审阅发现的夜景缩小、部分加载延迟释放与重挂载丢失 loading 状态均已用回归复现并修正。
- 真实 WebGL 脚本：`WBR_URL=http://localhost:5190 node scripts/verify-tree-debug.mjs`，输出 `artifacts/tree-debug/`。覆盖日夜两套来源、同一画布、无正式存储写入、快速切换／恢复、手机尺寸控制台、无树海岸排除，以及全部视觉风格和重复切换的 GPU 资源计数。
- 全量回归首先暴露两处既有 Canvas 2D mock 的 `getContext` 重载类型错误（被推断为 GPUCanvasContext），已仅在测试夹具中改为按 `2d` 返回并用完整 getContext 签名；不改变业务实现。
- 全部包的 Vitest、Web 构建、i18n 验证与 158 场景版本检查通过。全量命令最后一组本地网络／Windows Node 测试在沙箱中访问被拒；在本机环境重跑该组及最后版本测试，41/41 通过（`node-tests.log`），没有修改这些辅助测试的逻辑。完整输出保存在 `full-tests.log`，不把原沙箱命令的非零退出码写成成功。
- 浏览器报告有日／夜三档同画布切换、无存储写入、恢复与海岸排除；两套来源 × 17 种视觉风格均正常，无 shader 错误或外部请求。四轮反复替换／恢复后，渲染器计数稳定在 2 geometry／5 textures（包括宿主 style 的预热资源），未随轮数增加。报告与截图在 `artifacts/tree-debug/`；未进行 iOS／Android 真机帧率或正式发布验证。
