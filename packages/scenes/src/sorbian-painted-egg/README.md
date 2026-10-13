# 彩蛋寄春 · sorbian-painted-egg

C 档、低敏感度的当代手作致敬，关联 `sorbian-folk`；手势为 `drag` 与 `wishWrite`。由主应用配置 `veranda` 环境。

## 文化依据与边界

已阅读 `content/traditions/sorbian-folk.md`，并查看配图 `sorbian-folk.jpg`。该配图展示复活节骑乘巡游，不能作为彩蛋纹样的临摹依据。

核验日期：2026-10-13。

- [包岑市政府：Sorbian Traditions and Customs](https://www.bautzen.de/en/citizens-town-hall-politics/city-portrait/the-sorbs/sorbian-traditions-and-customs) 的 “Sorbian Easter Egg Market” 介绍公开彩蛋市场、手工装饰与公众观看、体验。它支持选择彩蛋工艺作为公开文化题材。
- [Museum Sorbische Webstube Drebkau：Ostereiermarkt 2025](https://www.sorbische-webstube.de/veranstaltungen/2670118/2025/03/30/ostereiermarkt-2025.html) 介绍馆内彩蛋艺术家示范及公众彩绘体验点。
- [Sorbian Information Centre：Sorbian Customs，Easter Egg Decoration，pp. 9–10](https://info.sorben.com/wp-content/uploads/2020/06/Br%C3%A4ucheENG.pdf) 的检索文本描述装饰彩蛋、赠礼和蜡绘等技法；PDF 直读在本次核验时超时，以上市政府与博物馆页面已成功读取。

本场景是**当代数字手作致敬**，并非传统技法教程。青蓝蛋壳、笔刷、浅染料碟和陶杯是原创构图；乳白短笔触与枝叶为自行编排的纹样，不复制某位工艺师的作品，不声称它们具有特定传统含义。没有仪式效力、疗效或护佑承诺，不模拟圣餐及其他圣事，不提供危险骑乘、热蜡或腐蚀性染绘玩法。

## 物件与动作

| 检查点 | 物件动作 | 命中与状态 |
| --- | --- | --- |
| 0 → 1 | 拿画笔添纹 | 拖动 `egg-brush-grip` 到 `egg-paint-surface`，笔触出现，画笔回到垫布；实际移动至少 8 CSS px |
| 1 → 2 | 把彩蛋放进陶杯 | 从可见蛋壳 `egg-paint-surface` 拖到陶杯前沿 `egg-cup-target`；整枚蛋进入陶杯 |
| 2 → 3 | 安静看春意或提交心愿 | 轻点蛋壳，轨迹与释放位移都小于 12 CSS px；或显式提交去首尾空白后的非空文字 |

主物件为 `sorbian-painted-egg`、`egg-brush`、`egg-display-cup`。蛋体 `egg-lathed-shell` 有上尖下宽的回转轮廓，彩绘 `egg-invented-motif` 逐点贴合相同曲面；`egg-paint-surface` 是蛋壳上的真实弯曲表面，不是透射点击平面。`egg-cup-target` 是杯沿的可见浅色点饰。`egg-cup-bowl` 内壁跟随蛋体下段，蛋放下时有真实承托接触。

画笔、蛋壳、陶杯和染料碟在 320 / 390 / 1280 px 中全部保留在画面内。所有起点与落点按整个场景最近的可见不透明网格判定；放下时仅排除手持物的整个子树，不排除其他遮挡物。动作按钮是原生 button，并与物件动作走相同检查点。

心愿框只在末步开放；静默轻点不保存草稿，回访不创建写愿控件，恢复任何检查点均不自动保存、触感提示或发送完成事件。页面暂停、失焦、多指、取消和丢失指针捕获均取消未完成拖动；已接受的动作暂停后续行。减少动态效果会直接落稳。

## 验证

`npm run test -w @wbr/scenes -- src/sorbian-painted-egg/scene.test.ts`

27 项测试，真实 Three.js 几何、射线、提示及 wishWrite 控件，仅替换 GPU 渲染。涵盖动作顺序、外部遮挡的起点与落点、误触与轨迹门槛、取消 / 捕获丢失 / 多指 / 暂停 / 失焦、检查点 0–3 静默恢复、减少动态效果、显式心愿与回访、三种宽度的首个命中和完整构图、纹样贴面、布垫 / 陶杯承托，以及几何、材质、阴影、提示、监听器和渲染器的幂等释放。
