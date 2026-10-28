# 仪式光效材质接入计划

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to execute this plan. User authorized implementation with “接入吧” after the linked audit and research.

**Goal:** 接入已核查的5个优先和40个可选场景部件，改善透光、局部散射和湿润反射。
**Architecture:** 在 scene-runtime 提供统一材质工厂与可传递至卡通适配材质的轻量着色补丁；场景只在核查过的部件构造处显式采用。既有点光、光晕、反馈与保存生命周期继续工作。
**Tech Stack:** 原生 Three.js 0.170.0、现有 postprocessing 6.39.5、少量 CC0 纤维数据；不增加 R3F 或全屏特效依赖。
**Spec:** [逐场审查](../../research/2026-10-28-material-lighting-audit.md)、[开源研究](../../research/2026-10-28-open-source-optics-materials.md)。

## Global Constraints

- 只覆盖已批准的45个候选场景；保留技术ID、隐藏状态、文案、动作、来源字段和材料身份。
- 纸、布、粥、蜡、玉保持实体遮蔽；纸布不使用alpha透明代替漫透射。
- 玻璃用Physical；小液面优先轻量受光、色深与Fresnel，高开销附加pass不作默认。
- 补丁支持默认toon-soft及风格切换，不丢现有shader、动态颜色/emissive/opacity；纹理GPU资源可释放。
- 场景运行时不联网；CC0资源保存来源/许可，MIT参考保留声明；数据纹理不按sRGB读取。
- 基础材质测试、真实WebGL编译/代表场景显示、交互/恢复、构建必须验证。

## Interface

新增 `@wbr/scene-runtime/ritual-optics`：

```ts
type RitualSurfaceKind = 'paper'|'cloth'|'leaf'|'wax'|'jade'|'skin'|'fruit'|'glass'|'water'|'tea'|'honey'|'wet'
type RitualSurfaceOptions = {
  kind: RitualSurfaceKind
  strength?: number // 0..1, backlight scattering strength where applicable
  thickness?: number // Physical optical path only
  fiber?: 'paper'|'linen'|false
}
createRitualMaterial(
  parameters: THREE.MeshStandardMaterialParameters | THREE.MeshPhysicalMaterialParameters,
  options: RitualSurfaceOptions
): THREE.MeshStandardMaterial
```

工厂对glass/tea/honey返回Physical子类，其余返回Standard或合适Physical；调用者保留返回实例并继续原有动画。保留现有map、vertexColors、side、适用的depth、色彩和反馈用途。`kind:'water'`默认alpha .58，命中水面均至少.55；显式opacity 0的待倾注流线继续从0动画。玻璃Physical以opacity=1保留真实透射，transparent分类仍为true以兼容宿主阴影策略。湿面保持不透明。root负责最终API及shader。

## Tasks

- [x] 1. 共享工厂与卡通兼容：测试先行，散射/纤维/液体补丁、原生玻璃、动态参数、缓存、dispose和风格切换。
- [x] 2. 纸/布/有机25场：在准确材质/部件接入工厂，拆除会误伤其它材料的共享材质，补每场README的技术/文化影响记录。
- [x] 3. 玻璃/液体/湿面/已有水光20场：保持操作/水位/点燃状态，接入工厂与必要局部光晕；每场README记明变化与文化边界。
- [x] 4. CC0纤维数据：Paper001和Rough Linen小尺寸粗糙度数据，来源、许可、下载/生成脚本；运行时离线使用。
- [x] 5. 验证：针对共享行为和真实场景接入检查，完整相关包测试/构建；代表场景真实WebGL画面与shader错误核对；修复后独立审阅。

## Review Focus

1. 透明目标仍可点/拖/放，特别漂洗水、玻璃和杯内辅助物。
2. 同材质用于其它实体时不被连带改成透光（粥/米、玉/陶、布/木框）。
3. 点燃/冷却/提起等emissive动画在styled clone里同步，暂停/恢复不跳闪。
4. 新着色项不穿透原有阴影；厚层/折边的遮光仍可读。
5. 反复进入/退出和风格切换不累积纹理、program或事件监听。

## Progress and rulings

- 已有研究和用户“接入吧”构成本轮范围授权，直接实施，不再重复询问设计确认。
- 当前分支codex/eight-language-i18n已存在用户其它未提交工作；本轮在当前工作区仅修改独立材质/场景/新增文档文件，不重置、切换或提交其它工作。
- 当前sandbox的.git只读；不进行分支/提交操作。原生工作树无已附可复用项。
- 实施采用分文件并行，root拥有共享runtime，场景两组及资产组各自互斥；遵守已启用的并行委派要求。
- 高开销MTM/BVH/全屏Bloom为研究备选，本轮采用前轮推荐的轻量首选路线。
- 独立审阅发现手部/白绢作用范围过大及透射物阴影分类问题；均已修正并经窄范围复审通过。新增局部性断言先RED再GREEN，runtime全量153项通过。
- 生产构建和移动端验证（含Android/iOS离线导出、DOM资源完整性）通过。sandbox初次本机回环访问受限，经受控执行重跑通过；没有因沙箱网络错误修改测试逻辑。
- 完整场景测试初次9426通过/5失败，集中在漂洗水命中契约、光晕共享几何资源归属及原玻珠alpha断言；逐项核对实际行为后修正，最终结果记入[交付记录](../../research/2026-10-28-ritual-optics-integration.md)。
- 上述三项测试契约已修正，7套定向124/124通过；45场README齐全且新增本地链接可解析。最终完整场景包268个文件/9433项全部通过，耗时253秒。
- 最终WebGL核验48项材质/风格、135个场景恢复状态/270次风格渲染均通过，无shader错误/失效链接程序/静默回退/黑帧/场景异常；已查看10场代表拼图，验证服务已停止。
- 最终文档与三项场景测试契约经独立完整性复审通过；临时工作报告归档到artifacts/ritual-optics，中央交付记录已补齐。手机真实GPU帧时间不在已验收结论中。

## 用户看图后的纸面层次细调

用户要求灯笼／纸伞的纸面透光与骨架遮光更明显，并提供真实前后对比，直接在原授权范围内继续调校。

- [x] 修改前保存上一版已接入光学的工作区源码快照；前态同时载入旧光学工厂及旧卡通适配器，防止材质状态错配。
- [x] 共享材质增加显式启用的横向／径向纸面结构，遮挡反射／发光并保持阴影与默认其他场景；测试先RED再GREEN。
- [x] 灯笼保留环骨数／位置和点光／光晕，降低均匀自亮、加强曲面纸面与七条环骨层次；纸伞保留色彩和机构，暗带对齐24真实伞骨并跟随折叠旋转。
- [x] 同视角／光照／状态、无调色实渲染对比与人工查看；独立审阅及哈希一致性通过。
- [x] 最终共享155、完整场景9437、构建、56项四风格WebGL和两场6状态／12次风格检查通过；两README及[二次调校记录](../../research/2026-10-28-paper-lighting-refinement.md)已更新，验证服务停止。
