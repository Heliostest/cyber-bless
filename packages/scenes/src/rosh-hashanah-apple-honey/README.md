# 蘸蜜迎岁

犹太新年苹果蘸蜜片段：拿起已切苹果片、蘸入蜂蜜，再提起回盘，准备品尝。苹果片是实际可抓取物件；错误对象、反向或无效轨迹不会推进。动作落定才保存进度。

宗教语境、来源正文、顺序差异及访问状态见[来源卡](../../../../content/traditions/rosh-hashanah-apple-honey.md)与[研究核查](../../../../docs/research/2026-10-20-rosh-hashanah-apple-honey.md)。这是果实祝福、品尝及新年祷愿背景中的有限蘸蜜片段；回盘、三短拖、方向、日光场地和器皿为产品安排，没有宣称已吃下、已完成祷告或完整节庆餐食。

`createAppleHoneyModel` 提供中空陶碟、蜜体、果肉／果皮与附着蜜层，`pose` 保持三个检查点连续。蜜层只在完整蘸入后显示；提起先越过碟口，回盘后由盘面承托。普通动画、减少动画及进度恢复一致。输入、暂停、取消、回调重入及GPU释放使用既有生命周期规范。

技术ID `rosh-hashanah-apple-honey`，引擎@1，来源同名专卡，C／中。接入blessing池，不启用愿望输入。测试、真实截图、浏览器原生触摸事件模拟和独立审阅存于 `artifacts/rosh-hashanah-apple-honey/`；触摸模拟不代表真机。

## 2026-10-20 介绍扩充核查

适用场景：`rosh-hashanah-apple-honey`；最终来源：`rosh-hashanah-apple-honey`。

当前物件与动作：苹果片拿起、蘸入实体蜜面、提起回盘。

文化说明范围：犹太新年宗教祝福、好甜新年祈求；中世纪法国记录为线索。

简化边界：苹果颜色、陶碟、回盘、白昼庭院为产品安排，未模拟食用。

完整来源、访问状态、年代限定和不能外推的范围见[本轮逐项核查](../../../../docs/research/2026-10-20-scene-narratives-c.md#rosh-hashanah-apple-honey)。用户介绍集中维护于 `packages/core/src/scene-narratives/c.ts`，此处不复制正文。
