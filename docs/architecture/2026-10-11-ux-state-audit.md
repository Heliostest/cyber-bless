# cyber-bless 操作/交互 UX 与 数据/状态 改进审计

- 日期：2026-10-11
- 基线：`master` @ `2f7c206`（PR #26，场景重走）；审计分支与 master 同一提交
- 范围：操作/交互 UX 与 数据/状态。**不做架构级建议**——那是 [`2026-10-11-framework-eval.md`](./2026-10-11-framework-eval.md)（下称 #25）的范围，本文只交叉引用、不重复
- 方法：逐个阅读 `packages/app`（App 壳、home、daily-scene-preview、scene-experience、scene-library、wishes/pages/vessels/scene-wish、ritual、woodfish、procedural-scene、reduced-motion、feedback-controls、reward-flight*、context、local-day、scene-placement、style.css 相关段）、`packages/core`、`packages/runtime`、`apps/mobile-expo`（App/BlessingDom/scene-cache）、`apps/cyber-bless`，并对照 `ritual-scenes.test.ts`、`app-shell.test.ts`、`home.test.ts`、`daily-scene-preview.test.ts`、`scene-records.test.ts` 确认行为
- 未做真机或浏览器实测；涉及运行表现的判断均来自代码推断，文中已标注
- 本次只审计，不改代码（未发现值得顺手修的一行级 trivial bug）

## 结论

**基础交互的地基是扎实的，问题集中在「跨入口共享进度」的语义缝隙和几处反馈不一致。** 重复提交防护（reducer 幂等 + 导航即卸载 + 木鱼手势去抖）、场景加载/失败/取消三态、#19 的奖励飞行（可打断、有时长上限、遵守减少动态）、#24 的今日预览（inert、离屏暂停、失败优雅退回静态卡）、#26 之后的重走规则，都有代码与测试双重兜底，无需动。

真正值得排期的是两个「数据已发生、用户却拿不到或丢东西」的缝隙：

1. **今日主仪式的跨入口语义**：从场景目录/仪式时光续走完今日主仪式，**不发小物不发功德**，今日卡片仍显示未收下，用户得从首页原样再走一遍（P0-1）；反过来，从今日卡片中途退出后再从今日卡片进入，进度被**静默清零**，而同一场景从目录进入却能续走——「从哪儿进决定是否续走」用户不可见（P0-1）。
2. **许愿小物（vessel）的「留下/不留下」选择可逃离**：小物在走完那一刻就已花费（`collectible.spend`），但写下的话存在组件 state 里；此刻返回或杀进程，**小物已消耗、那句话无声丢失**，且已花费的小物从选择器消失，无法回到这个选择（P0-2）。

其余为反馈一致性（完成行返回没有飞行）、目录加载态提示、减少动态被系统偏好覆盖手动开关等 P1/P2 小项。数据层（幂等、原子整档写入、restore 校验、移动端缓存与会话恢复）经核对**没有发现正确性缺陷**，只有文档化边界。

---

## 1. Interaction 发现

### 1.1 taps / 双击 / 重复提交 —— 总体扎实

- 「dispatch + 导航」类按钮（如 `wishes.tsx:233-243` 的「我的心愿实现了」）依赖导航后按钮随路由栈顶卸载来防连点；即使连点命中，reducer 幂等兜底：`wish.fulfill` 对已 fulfilled 返回原状态（`core/src/index.ts:257`）、`wish.create` 按 id 去重（`:213`）、`ritual.finish` 按 session id 去重（`:328`）。
- 木鱼输入做了完整的多指/长按/右键/拖出防护：`woodfish.tsx:143-204`（非主指针取消、`suppressClick` 吞掉浏览器补发的 click、拖动 >8px 不算敲击 `woodfish-input.ts:20`）。
- 场景完成信号重复上报有三层兜底：场景内「完成只报一次」、`LoadedScene` 的 `checkpoint` 注释明示「One record per visit」（`scene-experience.tsx:206-244`）、core 幂等（`daily.scene` 按 `daily:day:sceneId` 小物存在性早退，`core/src/index.ts:394-395`；`collectible.spend` 按 `spentAt` 早退，`:431`）。
- 未发现可复现的双击资损路径。

### 1.2 loading / empty / error 三态 —— 覆盖面好，两处小瑕疵

- 场景页三态完整：下载中带进度条与「取消并返回」（`scene-experience.tsx:650-671`，取消会 abort 并释放租约）；失败卡有人话原因 + 可折叠技术细节 + 「重试打开」（`:619-635`，`scene-load-error.ts` 保证永远是中文）；木鱼自带「正在布置小天地…/轻量模式」状态角标（`woodfish.tsx:215-220`）。
- 空态齐全：小天地空货架 + Empty 带 CTA（`pages.tsx:296-298, 325-332`）、目录搜索无结果（`scene-library.tsx:444-459`）、今日回看位空占位（`home.tsx:131-136`）、许愿小物为 0 时 picker 与还愿页各有空态 + 去今日看看（`pages.tsx:219-226`、`wishes.tsx:421-432`）。
- **瑕疵 A**：场景目录行 `disabled={!ready}`（`scene-library.tsx:434`）——冷启动缓存维护期间整页按钮不可按，页面本身却没有任何「正在准备」的说明，只有顶部计数。移动端 `io.cache.maintain()` 要列目录、读索引（`scene-library.tsx:259-284`），慢设备上可感知。
- **瑕疵 B**：远端场景的状态 chip 在 `library.status` 异步返回前一律显示「需下载」（`sceneStatus`，`scene-library.tsx:346-350`；statuses 异步填充 `:390-404`），随后跳变为「已缓存」。当前 11 个内置场景 `manifestUrl` 为空、不受影响，接远端目录后会造成「都要下载」的第一印象。

### 1.3 redo 体验（#26 之后）—— 规则已闭环，剩两个语义缝隙

#26 修复了「完成态打开落在完成行」的问题，`ritual-scenes.test.ts:516-532` 对「未走/半程/已完成」三态 + 各 flag 均有覆盖。剩余痛点都源于 `useOpenScene` 的置 0 条件（`scene-library.tsx:226-229`：带任一 flag 或已完成 → 置 0）：

- **缝隙 1（丢进度）**：今日主仪式走到 2/3 返回，再从今日卡片进入 → `{daily}` flag 强制置 0，前 2 步静默丢失；同一场景从「我的 › 场景目录」进入却能续走。用户看不到 flag，只看到「有时续走有时重来」。还愿（`wishId`）与 vessel 访问同理，但它们语义上就该从头走（`scene-redo.md` 的既定规则），唯独「今日主仪式中断续走」是用户合理预期。
- **缝隙 2（白走一趟）**：从目录/仪式时光**不带 flag** 续走完今日主仪式 → `checkpoint` 里 `if (daily)` 不成立（`scene-experience.tsx:212-224`），不发小物不发功德；今日卡片仍显示未收下（`home.tsx:27-29` 查的是当日小物存在性）。用户要么没意识到丢了奖励，要么得从首页再走一遍全程。这是 #26 让不带 flag 的入口「续走未完成的」之后新打开的缝隙——续走的前提恰恰是半程往往来自今日入口。
- 文案小刺：仪式时光场景卡写「已完成 3 步 · 再次打开」（`pages.tsx:500`），点开却从 0 走（已完成 → 置 0 重走），「已完成 X 步」与实际行为错位；当日已收下后再走完今日主仪式，完成行落回通用文案「这次体验已经完成，记录已留下。」（`scene-experience.tsx:502-509`），不解释为什么这次没有「收下它」。

### 1.4 完成反馈（#19）—— 飞行层本身无可挑剔，一处不一致

- 飞行层设计稳健：`RewardFlightLayer` 用 WAAPI `finished` 而非 animationend 上报落点、`pointerdown` 任意点击提前结束、`duration+700ms` 定时器兜底、`done` 标志保证只报一次（`reward-flight-layer.tsx:78-99, 133-147`）；放在按路由重建的 `<main>` 之外（`App.tsx:461-476`），换页不打断；减少动态时直接落定并读屏播报（`reward-flight.ts:52-60`）。
- Tab 跳 / +1 / 新标：落点解析有三级回退（货架槽 → 心愿卡 → Tab，`reward-flight.ts:63-81`）；到站后 hop、+1 徽标、「新」标与落点亮片各就各位（`App.tsx:318-331`、`pages.tsx:247-295`），4 秒后归位（`ARRIVAL_LINGER_MS`）。
- **不一致**：2D 完成页的 ✕ 与 Android 返回都走 `closeComplete`——数据已结算，贴纸照样飞进小天地（`App.tsx:134-144, 156-160` 有注释明说这是刻意设计）；但 3D 场景完成行（`dailyGranted` 分支）只有「收下它」按钮会飞，此时按顶部返回或 Android 返回只是裸 `back()`（`scene-experience.tsx:365-511` 各分支均未处理），飞行与 +1 反馈整个丢失。同为「数据已落定、只差仪式感」的出口，行为应一致。
- 读屏：进度行 `role="status"`（`scene-experience.tsx:328-330`）每步播报，木鱼 12 敲即 12 次播报——对计数的 SR 用户有用，但与 2D 页「提示变化太频不播报、只在完成时播报」（`ritual.tsx:166-171` 注释）的策略不一致，可择一统一。

### 1.5 今日主卡 3D 预览（#24）—— 交互安全已做足，差异点只剩已知项

- 误触：预览整体 `inert` + `aria-hidden`（`daily-scene-preview.tsx:122-123`）+ CSS `pointer-events: none`（`style.css:3987`），点击穿透到卡片按钮打开行走；HUD 由 CSS 隐藏（`style.css:3998-4000`）。
- 暂停：`running = active && onScreen`，后台与滚出视口都停帧（`daily-scene-preview.tsx:63-64, 102-115`，IntersectionObserver）；无 WebGL2 或场景失败时静默退回静态卡（`:116`），不阻塞主流程。
- 与全场景的差异：预览站第一步、无声、不写任何状态（`progress: 0`、`checkpoint` 空操作、`isSoundEnabled: () => false`，`:78-84`），卡片点开后的行走从同一视觉状态开始，预期一致。木鱼预览读的是捆绑模型、不拉更新不确认下载（`previewContent`，`:30-43`，有测试 `daily-scene-preview.test.ts:207, 236`）。
- 遗留差异只有 #25 已立案的两项：陀螺仪手势在预览里仍挂载（`#25` §3.4 / P1-1 的 `mode: 'preview'`），以及常驻 rAF 的真机开销（#25 §3.5 / P1-2）。本文不重复。

### 1.6 祈愿 vessel picker —— 流程顺，两个小刺

- 无小物：picker 空态「还没有许愿小物…去今日看看」（`pages.tsx:219-226`）；还愿页同理（`wishes.tsx:421-432`）。
- 选择流程：picker 展开 `scrollIntoView`（尊重减少动态，`pages.tsx:181-186`），「祈愿」按钮带 `aria-expanded/aria-controls`（`:154-162`）。
- 小刺 1：从 picker 进入场景页后返回，`Wishes` 组件随路由重建而重挂载，`praying` 折叠态丢失（`pages.tsx:62` 的 state 在 `App.tsx:461-467` 的按路由重建中归零），用户回到心愿页发现选择器收起了，未完成的选择要重新展开。
- 小刺 2：还愿页 `method === "ritual"` 且未完成小仪式时提交按钮禁用（`wishes.tsx:465-471`），禁用原因只靠上方「已完成/挑一个小物」的区块状态说明，按钮本身无解释——可接受，列为观察项。

### 1.7 返回导航 —— 栈行为正确，与数据层的交互见 2.1/2.4

- 顶栏返回与 Android 返回键同源（`backRequest` 计数 → `back()`，`App.tsx:152-161`；原生侧 `apps/mobile-expo/App.tsx:65-69`，`canGoBack` 为假时交还系统退出）；2D 完成页的返回被特判为 `closeComplete`，两个出口行为一致。
- 场景中途离开无阻断：每步 checkpoint 即写盘，离开不丢（除 1.3 缝隙 1 的 flag 置 0 场景）；租约在 effect cleanup 里释放（`scene-experience.tsx:608-611`）。
- `go()` 的栈去重规则（已开页复用、`new→wish` 与 `complete` 替换栈顶，`App.tsx:76-97`）有注释、有测试（`app-shell.test.ts:13`），未见错栈路径。

### 1.8 减少动态 / 触觉 / 声音门控 —— 一处开关语义问题

- 三项设置全程「活读」：场景内 `isSoundEnabled: () => latest...sound`（`scene-experience.tsx:64`、`procedural-scene.ts` 注释）、`feedback()` 先查声音开关（`App.tsx:211-213`）、`haptic()` 查震动开关（`:207-209`）；无震动能力的宿主直接隐藏开关（`App.tsx:373`、`feedback-controls.tsx:21`、`pages.tsx:444`）。
- **问题**：`followSystemReducedMotion` 在系统偏好**变化时无条件覆盖**应用内开关（`reduced-motion.ts:22-36`）——用户在系统开启减少动态的情况下手动关掉 App 内开关，之后系统查询值一变（如部分系统在省电模式下自动开启），App 内开关被静默掰回。注释说「toggle 仍可覆盖」，实际只能覆盖到下一次系统变化。建议只在用户从未手动改过时跟随（记一个「已手动设置」位），或只自动开启、不自动关闭。

### 1.9 stuck done rows —— #26 后未再见卡死路径

完成行可达的分支逐一核对：`returnedFor` / `dailyGranted` / `vesselSpent` / `keptWish` / 通用（`scene-experience.tsx:363-511`）都有出口按钮；木鱼完成后 `disabled={progress >= steps}`（`:340`）但重开必置 0，不再有「敲不响又无处可去」的死局。唯一接近卡死的是 1.3 缝隙 2 的通用分支（不算卡死，算反馈缺失）。另注意 `collectible.spend` 对不存在/非许愿小物会 throw（`core/src/index.ts:427-429`），经 App 的 dispatch 包装变成顶部错误横幅（`App.tsx:384-398`）而非卡在完成行——正常流程到不了（vessel id 来自打开时的存活状态，单线程内不会中途消失），列为防御性正确。

### 1.10 预览 vs 全场景一致性 —— 已对齐

同一 `data-scene`/`data-stage` 钩子画同一片天空（`daily-scene-preview.tsx:125-131` vs `scene-experience.tsx:97-105`），视觉连续；行为差异（进度/声音/HUD）都是「预览更安静」方向，见 1.5。

---

## 2. 数据 / 状态发现

### 2.1 `sceneRecords` 跨入口共享进度 —— 单整数模型的既定代价

- 正面：一个场景一个进度整数（`core/src/index.ts:79-82`），所有结算幂等键都不依赖它（daily 按日期小物、spend 按 `spentAt`、ritual.scene 按 visit id），所以共享进度**不会产生重复结算或竞态**（单线程 reducer + 串行写队列，`runtime/src/index.ts:38`、`apps/mobile-expo/App.tsx:47-53`）。
- 代价即 1.3 的两个缝隙：flag 决定置 0（丢进度）、无 flag 完成不结算（白走）。这是产品语义问题而非数据错误——但它是本次审计唯一可能导致「用户做了正确的事却拿不到/丢掉既得物」的路径，故列 P0。
- 边界确认：`scene.visit` 会把记录移到队首并刷新 `lastOpened`（`:205`），仪式时光列表因此「最近打开在前」，与时间线倒序一致，无排序问题。

### 2.2 `daily.scene` 幂等与日切 —— 正确，边界已想清

- 幂等键 `daily:{localDay}:{sceneId}`（`:77-78`），同日重走、末步重报都早退；grant 在走完的 `checkpoint` 时刻发生而非「收下它」点击时，数据先行、飞行只是仪式感——与 2D 完成页同一哲学，一致。
- 日切：`useLocalDay` 每分钟 + 可见性 + active 三钩检查（`local-day.ts:9-27`），`Today` 按 `key={day}` 重建（`App.tsx:335`）；跨零点在途的行 用打开当天的 day 结算，落到昨天名下，合理。时区以设备本地日为准（`core/src/index.ts:462-464`），旅行改时区可能同一 UTC 日收两个小物——属「本地日」语义的自然结果，不算缺陷，建议在文档里写明即可。

### 2.3 collectibles spend / 持久化 / 失败回滚 —— 无需回滚，设计自洽

- 整档 JSON 单 key 原子写（`runtime/src/index.ts:33-52`；localStorage `setItem` / AsyncStorage `setItem` 均原子），**不存在半档状态**：写失败时内存态保留、横幅 + 「重试保存」（`App.tsx:449-454`）、`beforeunload` 拦截（`:169-175`）、移动端后台即 flush（`:162-190`）。若用户在 save-error 后杀进程，重载回到最后一次成功写入的完整快照——小物花费与心愿笔记同进同退，不会出现「小物没了但心愿没记上」的中间态。这是当前「每次 dispatch 全量写」换来的正确性，值得保留（写合并/节流见「不做」）。
- 真正的缺口在 React state 侧：见 2.4。

### 2.4 wish keep / discard —— vessel 的一句话会丢（P0-2）

- 普通行走的许愿框逐句即时落库（`scene-experience.tsx:255-263` → `sceneWish` → `wish.create`），无丢失窗口；空行不保存，超长截断进 intention（`scene-wish.ts:9-27`）。
- vessel 许愿行走完时：`collectible.spend` 已发生（`:226-233`），但写下的话只存在 `heldWish` / `typedWish` 两个组件 state 里（`:187-189`）。「留下/不留下」选择屏（`:414-487`）可以被顶部返回、Android 返回、杀进程、WebView 崩溃（`apps/mobile-expo/App.tsx:118-121` 触发整页重挂载）任何一种方式逃过——小物已消耗、话没留下、picker 不再列出已花费小物（`vessels.ts:18` 过滤 `spentAt`），**这个选择一去不返**。「不留下」是明示按钮（还带读屏播报 `:430-433`），「悄悄离开」不是。修法方向（任选其一，都不动架构）：选择屏出现前先把句子存为心愿再让用户「留下/删掉」；或把 held 行升到 App 级 state（同 `fulfillmentDrafts`，`App.tsx:51-53, 376-383`）使返回后可回；或在此屏拦截返回并确认。
- 顺带：`fulfillmentDrafts`（还愿页草稿）同样不持久化，长文被杀丢稿——量级小得多，P2。

### 2.5 migrations / restore 校验 —— 严谨，一个降级边界

- `restore` 逐字段深校验、心愿交叉引用核验、失败原样保留（`core/src/index.ts:526-594`），坏档不会破坏原数据，加载失败有「重新读取」（`App.tsx:260-267`）。
- 边界：`version` 严格等 1（`:535`）。未来 v2 存档落回旧版 App 时报「存档格式不受支持」且「重新读取」永远失败——可接受的降级保护，建议将来升版时在文案里给出「请升级 App」的指引即可，现在无需动作。
- 一个文案重叠的小问题：`scene.visit` 检测到引擎版本变化会 throw「此场景的玩法版本已变化…」（`:202`），该消息进顶部错误横幅（`App.tsx:390-395`），但随后 `SceneExperience` 又抛「场景记录无法更新」占住失败卡（`scene-experience.tsx:579-580`）——用户同时看到两条不同的话，真正有用的那条反而在横幅里。P2 级打磨。

### 2.6 Expo 宿主边界 —— 缓存与崩溃恢复设计到位

- 下载：临时文件原子落位（`.part` → `move`）、SHA256 全量校验、20 秒超时、断点清理、HTTPS-only、磁盘余量预检（`scene-cache.ts:119-197`）；DOM 桥消息乱序有 `cancelledRequests` 补偿（`:227-235`）。
- 崩溃恢复：WebView 内容进程终止 → `resetSceneCacheSession()` 以 epoch 使旧 owner 的 protect 失效并统一释放（`:258-265`、`App.tsx:75-79`），存档经串行队列已在此前落盘——丢的只是未完成路由与 React state（含 2.4 的 held 行）。
- 单 GL 上下文：路由只渲染栈顶页（`App.tsx:461-467`），预览与全场景互斥；10 个程序化场景 dispose 均 `forceContextLoss`（`packages/scenes/src/*/scene.ts` 各文件末尾，grep 可证）。今日卡（预览卸载）→ 行走页（新画布）的快速交替按代码推断不会积压上下文，**但未在真机验证**，并入 #25 P1-2 的真机测试项一起看即可。

---

## 3. 排序 backlog

| # | 标题 | 为何 | 工作量（人日，粗估） | 风险 | 主要文件 |
| --- | --- | --- | --- | --- | --- |
| **P0-1** | 今日主仪式的跨入口语义：续走不丢步、走完必结算 | 1.3 缝隙 1/2：目录续走完成今日主仪式不发小物，用户白走一趟还得重来；今日入口重进又静默清零半程进度。方向：无 flag 完成时若该场景是当日 primary 则补 `daily.scene`（幂等键天然防重），今日卡片对半程场景给「续走」而非重开（或复用 2D 的 resume 横幅样式） | 1–1.5（含测试） | 中：动结算语义，需补「目录完成今日主仪式也只发一次」等用例 | `scene-experience.tsx`、`scene-library.tsx`、`home.tsx`、`scene-placement.ts`、`ritual-scenes.test.ts` |
| **P0-2** | vessel「留下/不留下」不可逃离（或逃离不丢话） | 2.4：小物在完成瞬间已花费，held 句存组件 state，返回/杀进程即无声丢失且不可回访。方向三选一见 2.4，推荐「先存后选」或升 App 级 state | 1（含测试） | 低-中：改完成行分支，注意与 1.4 的一致化合并做 | `scene-experience.tsx`、`App.tsx`/`context.tsx`、`ritual-scenes.test.ts` |
| **P1-1** | 完成行返回与「收下它」出口对齐（补飞行） | 1.4：3D 完成行返回无飞行无 +1，与 2D 完成页 ✕/返回的既定设计相悖；与 P0-2 同处一个组件，宜同批改 | 0.5 | 低 | `scene-experience.tsx`、`App.tsx`（参照 `closeComplete` :134-144） |
| **P1-2** | 目录 ready 态可见化 + 状态 chip 防跳变 | 1.2 瑕疵 A/B：冷启动整页禁用无说明；远端场景 chip 先「需下载」后「已缓存」 | 0.5 | 低 | `scene-library.tsx` |
| **P1-3** | 减少动态开关不被系统偏好覆盖手动选择 | 1.8：系统查询一变即掰回，手动关闭形同虚设 | 0.5 | 低（需想清「跟随系统」位的存档位置；不升存档版本，可复用 settings 邻位） | `reduced-motion.ts`、`pages.tsx` |
| **P2-1** | 仪式时光/重走文案打磨 | 1.3 文案刺：「已完成 3 步 · 再次打开」与从 0 重走不符；当日已收下后的通用完成行不解释 | 0.25 | 低 | `pages.tsx:500`、`scene-experience.tsx:502-509` 文案 |
| **P2-2** | 返回心愿页后祈愿 picker 保持展开 | 1.6 小刺 1：`praying` 态随路由重建丢失 | 0.25 | 低 | `pages.tsx`、（state 上提或持久于路由） |
| **P2-3** | 引擎版本变化的双文案合一 | 2.5：横幅与失败卡各说各话 | 0.25 | 低 | `scene-experience.tsx:579-580`、`scene-load-error.ts` |
| **P2-4** | 「正在保存…」指示去抖 | 2.3：木鱼 12 敲 = 12 次全量写 + 角标高频闪「正在保存…/本机珍藏」（`runtime/src/index.ts:37`、`App.tsx:437-448`）。只动展示层（如 saving 态 ≥300ms 才显示），**不动写盘语义** | 0.25 | 低 | `App.tsx` |
| **P2-5** | 还愿草稿（fulfillmentDrafts）持久化或离开提醒 | 2.4 顺带：长文被杀丢稿 | 0.5 | 低 | `App.tsx:51-53` |
| **P2-6** | 场景页进度行补 progressbar 语义；与 2D 播报策略统一 | 1.4 读屏两条；`role="status"` 每步播报 vs 2D 只播完成 | 0.25 | 低 | `scene-experience.tsx:328-330`、`ritual.tsx:166-171` |

合计：P0 约 2–2.5 人日，P1 约 1.5 人日，P2 合计约 1.75 人日。

## 4. 明确「不做」

- **不重复 #25 的架构项**：预览模式 `mode: 'preview'`（#25 P1-1）、真机帧预算（P1-2）、注册表收敛（P0-3）、步数入元数据（P0-1）、`LoadedScene` 拆分（P2-1）、检查点 schema 版本化（P2-3）等，本文仅交叉引用。P1-1/P0-2 虽也改 `scene-experience.tsx`，但只在现有分支结构内改行为与文案，不做组件拆分。
- **不引入写盘节流/合并**：每次 dispatch 全量原子写是 2.3 正确性的根基（半档不可能），节流会扩大崩溃丢失窗口；只做 P2-4 的展示层去抖。
- **不做路由栈持久化**：WebView 崩溃重挂载回到今日属可接受行为；只为 P0-2 的 held 句做最小持久，不扩大范围。
- **不做存档 v2 / 云同步 / 跨设备**（同 #25 非目标）。
- **不为时区旅行导致的同日双收做防护**：本地日语义正确，文档记一笔即可。
- **本 PR 不实现以上任何一项**：本文档只审计与排序，修复按 backlog 另行开 PR。
