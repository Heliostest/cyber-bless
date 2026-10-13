# 四件物品与岁时心意

用户授权自行选题、直接实现并验证后本地提交。干净 master 基点 94f0182；本批分支 codex/object-first-seasonal-four。沿用既有场景架构、柔和圆润主体、奶油 UI、本地 Kenney / Poly Haven CC0 环境。

| id / 标题 | 三个持久检查点动作 | 来源 / 分类 / 环境 |
| --- | --- | --- |
| omikuji / 签纸慢读 | 从签筒拖向倾斜落点轻摇 → 从露出的签棒向上抽取并展开原创提示 → 将纸签拖入信封 | omikuji / 祈福 / courtyard |
| polish-blessing-basket / 一篮春食 | 拖面包入衬布篮 → 拖彩蛋入篮中蛋窝 → 点篮静看或明确提交感谢 | polish-folk-catholic / 心愿 / veranda |
| navruz-sumalak / 春锅共煮 | 从木勺沿锅边可见弧段缓搅 → 拖勺到空碗舀入 → 拖盛好的碗到共食垫 | uzbek-folk / 祈福 / courtyard |
| floating-lantern-loy-krathong / 叶舟寄意 | 拖花到折叶浮灯中央 → 点亮烛芯 → 拖叶舟到水面涟漪，亦可在此步明确提交心意 | floating-lantern-loy-krathong（仅泰国支）/ 心愿 / waterside |

每场景独立原创主体：六棱签筒/纸签信封、编篮与圆面包彩蛋、大腹锅木勺与陶碗、香蕉叶折面浮灯与码头水面。主体有支撑与接触阴影，不复用旧主体换皮。只观察本地参考图，不把有署名或相同方式共享要求的图片嵌入产品。无新运行时依赖或外网资产。

真实物体射线命中启动，提示锚定命中几何；落点使用同一真实空间位置。共享 createObjectPointer 保证单指所有权、取消、失去捕获、暂停恢复；轻点验证全程最大位移防止拖出又回误触。辅助按钮走同一动作，原生 Enter/Space 可用。减少动态效果保留交互。暂停清理指针、隐藏 cue、禁用书写；恢复 0–3 不重放音效、进度、保存和完成事件。仅表单明确提交保存新心愿，安静结束与 returning 不新增心愿。销毁完整释放资源与监听。

文化边界：签纸使用原创自省短句，无吉凶等级或重抽获奖；食物篮是圣周六家庭准备的改编，不模拟圣职祝福；苏玛拉克呈现诺鲁孜邻里共煮/分享，不模拟拜仪，不把数秒互动称为真实烹饪；叶舟仅致敬泰国水灯节，不混中元、天灯或供灯，附现实材料与地方规范说明。全年目录为节俗回看，不暗示当天正在过节，不承诺功效。

已阅读四篇本地传统说明及对应图片；核对公开机构资料：[JNTO 御神签](https://www.japan.travel/en/japan-magazine/2007_omikuji/)、[波兰外交部食物篮说明](https://www.gov.pl/web/greece/dishes2)、[乌兹别克旅游局诺鲁孜](https://uzbekistan.travel/en/o/navruz-and-spring-equinox/)、[泰国旅游局水灯节](https://www.tatnews.org/2024/11/loi-krathong-festival-2024-experience-thailands-enchanting-festival-of-lights/)。资料用于语境和外形核对，未复制图片、真实签文或宗教脚本。

验收：实际几何与投影 cue 手势测试、误操作/多指/暂停/恢复/销毁、三宽度 320/390/1280 逐步截图、键盘和书写/还愿保存、27 场景无外网请求/错误与 WebGL contexts 完全释放。运行 npm test、npm run build、npm run mobile:verify。扩展目录每日 UTC 日序全部可达。构建与浏览器运行串行。保留本地功能提交，不合并、不推送。
