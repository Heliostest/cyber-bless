# 下一批物品交互场景

用户已要求合并并推送现有交互，再继续新增场景；沿用现在的物品优先方式，既有动物森友会方向的柔和材质、奶油 UI 和外部 CC0 村落环境。`3173bdf` 已合并并推送 master，合并树 884 个测试通过。本批在 `codex/object-first-next-four-scenes` 完成后先保留本地，下一次合并按用户指令。

| id / 标题 | 三个存档步骤与真实物品动作 | 分类 / 环境 |
| --- | --- | --- |
| omamori-cycle / 御守伴行 | 点选封闭小袋 → 拖到包上扣环 → 点小袋静候或在表单留一句心意。还愿：选袋 → 拖到返还箱 → 点箱致谢 | 心愿 / veranda |
| shrine-suzu-bell / 庭前一铃 | 从真实铃绳向下拖动摇铃 → 点绳轻收，让铃安静 → 点铃结束问候 | 祈福 / courtyard |
| st-brigids-cross / 草编迎春 | 依次拖四束灯心草到当前折编点 → 拖草编十字到门楣挂点 → 点挂饰静看 | 祈福 / veranda |
| bokjori / 竹筛迎岁 | 拖竹筛到米盘纳一小撮 → 拖到墙上挂点 → 点竹筛结束静看 | 祈福 / veranda |

四个 hero 几何和动作独立。御守保持封闭，不拆袋、不模拟制作秘符；铃绪与夏日风铃分开，铃声不累积得分。草编与竹筛说明各自的岁时语境，目录全年提供的是产品改编的手作回看，不声称当天正在举行真实节庆，不新增强制提醒或时间限制。

所有步骤在实际可命中的对象上注册 `addInteractionCue`，拖动目标来自真实命中物体或同一空间位置。用 `createObjectPointer` 统一单指归属、取消、暂停、失去捕获和多指保护；辅助按钮调用同一动作，书写只在显式提交时保存。0–3 恢复不重复进度、音效、心愿或完成事件。暂停清指针且隐藏提示；减少动态效果不冻结交互计时；退出释放 renderer、几何、材质、灯光、DOM 和监听。

构图在 320/390/1280px 下保持所有当前 source 和 target 完整可见。原有共享渲染、Kenney 小景与 Poly Haven 本地天空资源复用；不增加运行时外网请求或依赖，不把原有场景改成新场景的皮肤。

资料：本地 `content/traditions/<id>.md` 和对应 .jpg 用于观察，产品资产全部程序化原创。已核对 [国学院守札条目](https://d-museum.kokugakuin.ac.jp/eos/detail/id=9633)、[神社本厅英文导览](https://www.jinjahoncho.or.jp/en/assets/pdf/pamphlet/jinja_EN.pdf)、[爱尔兰国家博物馆民俗记录](https://source.museum.ie/en-IE/Collections-Research/Folklife-Collections/Folklife-Collections-List-%281%29/Religion-and-Calendar-Customs/St-Brigid-s-Day)、[韩国学中央研究院福笊篱条目](https://encykorea.aks.ac.kr/Article/E0023713)。互动压缩、米盘采米及静看步骤是产品改编，不当作完整仪轨教程。

验收：四个新模块真实几何与指针测试；全套测试、Web 构建和双端离线导出；三个尺寸逐步截图、真实 cue 坐标操作、按钮/键盘替代、恢复/还愿；23 场景进出与 GPU 释放；独立审查后修复。
