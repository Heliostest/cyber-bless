# 五果迎春：实际呈现与来源核查

场景ID：vietnamese-five-fruit-tray。核查日：2026-10-23。实际呈现五类备好果物：青蕉组、柚、橙、青苹果与梨。朱红色低平木盘与准备板、石台庭院。青蕉与柚先放好，三种动果分别抬起、移近、放低，每果落定才推进。对象为越南Tết祭祖果盘的准备片段，感恩与新岁平安丰足的祈愿；不完成整场家祭、不称神灵应允。

主目录133（含67隐藏）、共享143accepted及所有claims、72可读分支catalog和历史按mâm ngũ quả/mam ngu qua/five-fruit/五果检索无同题；vietnamese-folk总卡提到五果，但其旧策划评级不是本场证据，新增直接专卡；不与旧玩具竹蜻蜓或罗什哈沙纳蘸蜜混同。

| 对应主张 | 来源、定位与发布日期 | 实际访问 | 支持范围与限制 |
| --- | --- | --- | --- |
| 五果盘用于Tết祭祖，选果随地区、时代和家庭变化；北部常见选择含橙、香蕉、柚、青苹果和梨。 | [Traditional foods offering to ancestors on Tet festival／Viet Nam Government News（Thuy Dung）](https://en.baochinhphu.vn/traditional-foods-offering-to-ancestors-on-tet-festival-11140429.htm)；L187–190；2021-02-12 | 实现者与独立者2026-10-23均实际读相关正文 | 机构文化综述，非田野原件；支持所选五类物类，不规定每家必须恰好这些果种。 |
| 五果盘寄托对祖先与土地神的感恩；并不严格只有五种；朱红色木盘与常见蕉承柚陈设。 | [Tet fruit tray, indispensible part of Vietnamese culture／VietnamPlus（VNA）](https://en.vietnamplus.vn/tet-fruit-tray-indispensible-part-of-vietnamese-culture-post146190.vnp)；正文祭祖感恩段、果种与摆盘段（实现者提取L20–37；独立提取相关L18–25）；2019-02-04 | 实现者与独立者2026-10-23均实际读相关正文 | crimson wooden tray支持红色木盘，不证明红木树种；本场低平展开式摆法与常见层叠不同，是产品设计。 |
| 祭祖感恩背景及祈求新岁平安、健康、丰足；不同地区选果、寓意有差异。 | [Arranging five-fruit tray during Lunar New Year celebration – a Vietnamese tradition／VietnamPlus（VNA）](https://en.vietnamplus.vn/arranging-five-fruit-tray-during-lunar-new-year-celebration--a-vietnamese-tradition/279358.vnp)；相关段落“showing respect and gratitude to ancestors and praying for a year of peace, good health, and prosperous business”（实现者网页提取L38，独立提取L35）；2024-02-08 | 实现者与独立者2026-10-23均实际读相关正文 | 不泛化东亚全部信念或具体果种统一寓意，不采用健康营养段、起源、期限、资格和应验承诺。 |

以上为机构文化综述，不冒称田野原件或所有家庭统一规则。只实际读相关正文，不称通读网页所有关联新闻。VNAT13636仅单行空链接，未实际读正文，不据搜索摘要登记。来源照片未读像素，不称按图复刻。

## 事实与产品

事实：祭祖/土地神感恩与新岁祈愿，有限果种选择及地区差异；五果盘名称不等于必须五种或五枚。来源所述常见蕉承柚、朱红高脚木盘保留记录。

产品：本场选五类果物并非统一清单；原创低平木盘展开式、蕉柚分别落在盘面、具体比例/树种未定/配色/果物造型、准备板与石台庭院、三种动果/顺序/次数/右拖/动画反馈是产品安排，与所引层叠有明确差异。UI保留为祭祖备果的语境，不改成原本只是普通装饰，不称完整礼仪/神力/期限/资格/起源。

最终来源slug：vietnamese-five-fruit-tray，注册/metadata/宿主统一。地图以河内现代文献代表点及2019VNA日期定位，不称起源或本场实景。

## 实现与技术验证

实际阅读最终来源卡、宿主介绍、祈愿动作、三个操作提示和结语，均限定于祭祖备果片段与新岁祈愿。未把本场具体果类、展开布局、安放顺序和三次右拖写成传统要求。

最终运行源码冻结后，完整`npm test`于2026-10-23T09:39:20.518Z以0退出：core56、runtime11、App930、gestures54、shared3、scenes7464、content37、scene-runtime142，共8697项。新场景74项（模型7、交互67），连同注册表188项定向测试通过。Web生产构建、移动端类型及依赖兼容检查、小组件检查和Android/iOS离线导出通过；未声称完成Swift/Kotlin原生编译或物理手机测试。

独立实际网格核查覆盖25个网格、303个姿态和9段连续路径，核对真实果底支撑、盘沿净距、果蒂/叶连接及四根香蕉体之间的分离。香蕉体原有相交经实际闭合曲面回归先失败后修复，再独立通过；不把相机投影重叠当成网格相交，也不以包围盒代替实际网格。鼠标320/390/1280px、触摸事件模拟320/390px、180px长拖与完整动作流程均通过，浏览器错误与外部运行请求为空，退出后GPU存活资源为0。旧133条小组件记录与399张封面保持，当前402张Android拷贝一致。

原始安装准备失败、资源竞争下旧App用例的5秒超时，以及浏览器无效手势夹具和脚本退出码问题均保留在本地`artifacts/vietnamese-five-fruit-tray/debug-notes.md`及原日志。最终成功不改写中间失败，也不把安装后的工作区检查冒充改动前基线。技术验证与来源正文审阅分别记录，测试通过不证明文化事实。

独立最终审阅通过，阻断项0：实际阅读24张鼠标/键盘检查点、8张触摸模拟、10张自然鼠标动作、2张宿主界面和3张封面，共47个唯一文件路径；这不是47个不同画面状态的主张。每张记录尺寸、SHA和实际阅读状态；逐个HTTP核对20张画廊图、5项源码和生产构建，旧资产与主目录保全通过。来源、实现、几何和像素审阅分别见本地`independent-source-review.json`、`independent-implementation-review.json`、`independent-geometry-review.json`、`independent-visual.json`及`independent-final-review.md`。

## 核查清单

- [x] 实际物件、材料、动作、场合与完成列清，不反证传统。
- [x] 三条直接对应正文实现者与独立者实际读到，未读/空索引明列。
- [x] 全目录与来源卡检索去重，新增对应专卡，不借地区总卡。
- [x] 祈愿与祭祖背景保留，产品布局/三动作分列，无起源/统一数量/功效承诺。
- [x] 宿主/注册/模块/README/来源与适用原生目录同步。
- [x] 用户介绍、提示和结语逐句最终核查。
- [x] 技术测试、实际网格与当前实图分别完成记录。
