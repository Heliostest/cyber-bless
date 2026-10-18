# 釉彩映晴

## 2026-10-19 来源核查修正

现关联改为直接对应器物、工艺或节庆行为的专卡。原地区或宗教总卡不足以单独证明本场景的文化来源；具体证据及产品动作边界见下方审阅记录。

当前来源：`content/traditions/andalusian-ceramic-tile.md`。核查依据与原关联的问题见[全场景来源审阅](../../../../docs/research/2026-10-19-scene-culture-audit.md)。


ID `andalusian-ceramic-tile`，导出 `createAndalusianCeramicTile`。C级、中敏感；`andalusian-ceramic-tile` 地区卡索引。`drag`、`wishWrite`，三个检查点。

本地卡 `content/traditions/andalusian-folk.md` 及 JPG 已阅读/查看：照片是埃尔罗西奥途中骑马队伍，并非陶瓷工艺参考。场景是原创公共日常工艺欣赏，不复现该朝圣、圣像或圣事。现采用特里亚纳陶瓷与花砖专卡，不以朝圣资料证明花砖工艺。

2026-10-13 成功读取塞维利亚官方旅游机构的 [Triana Ceramic Center](https://visitasevilla.es/en/triana-ceramic-center/)：陶瓷中心保存原址窑炉、作坊关系及陶瓷展示，用于说明区域陶艺历史。只据此建立地域与工艺关联；花瓣形、九砖布局、木框和配色均为本项目原创，不复制馆藏或工匠图案。

拿起桌前实际陶砖补齐中央空位，握住木框移动整幅至展托，最后轻点静看或明确提交一句心愿。静看丢弃未提交草稿；还愿不出现输入、不创建心愿。辅助按钮提供键盘完成路径。

接触结构：陶土砖背、釉白面和浅浮花心，砖缝露出底床；木框底部接触软垫。散砖平放桌面，嵌入后归属整幅组，拖动/取消不脱落。提示对应 `tile-loose-grip` → `tile-empty-seat`，`tile-frame-grip` → `tile-display-seat`，最后 `tile-frame-grip`。提示锚点均为实际表面；命中检测遍历所有可见不透明网格，只在落点检测中排除被拖组。

定向验证：`npm test -w @wbr/scenes -- src/andalusian-ceramic-tile/scene.test.ts`。先用空实现观察输入层缺失 RED，再实现流程。38项真实几何/射线/提示/表单测试覆盖三宽度、错放、遮挡、取消、失焦、暂停、多指、恢复、重入、心愿提交与资源销毁，以及砖背/底床和木框/托垫接触、花瓣实际厚度、保存或进度回调立即关闭或暂停场景时停止后续反馈/渲染。只替换 GPU 渲染边界。完整浏览器、布局、GPU、移动导出由本批整合记录列出。

若保存回调只暂停场景，已接受的保存仍同步报告完成检查点一次，再跳过反馈；恢复不会再次保存。若回调销毁场景，则不再调用其宿主进度或渲染。
