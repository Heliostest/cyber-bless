# 更蓝的日景天空与夜景云层

日期：2026-11-04（Asia/Shanghai）。用户要求天空更蓝，并为夜间加入适当的天空/云配色，高度和纵向分布与白天一样。

## 实现与适用范围

- 85 个既有日景保留亮白云，天空地平线色从 `#addff4` 调为 `#6ec5ff`、天顶从 `#57aee8` 调为 `#278fe6`，提高蓝色与亮云的对比。已调整的日景雾距、器物曝光及光照不变。
- 五个 App 可见夜景增加六层灰蓝云：`brat-bride-cloth`、`scottish-first-footing`、`diya-oil-lamp`、`votive-candle-catholic`、`yeondeunghoe`。夜间背景改为地平线 `#1b355d` 到天顶 `#08152f` 的深蓝渐变，远雾色同步为 `#20395a`。保留原夜雾距离、灯光方向/强度、暖光、火焰、纸灯、辉光与 IBL。
- 云组件只增加 day/night 配色参数；六层共享几何、透明度、柔边、漂移、48 CSS 像素最上沿和相对纵向偏移 0、22、45、69、94、120。内五层保留最多 1.25 像素起伏。减少动态、暂停、预览冻结和资源释放机制共用，昼夜均不改相机或交互布局。
- 夜景绘制背景与摄影 HDR 光照分离：HDR 继续加载并用于 environment，不覆盖生成的夜空纹理；两者各自持有和释放。可见夜景背景以自身暗色为准，不再叠加旧摄影背景的 .065 倍强度。隐藏夜景仍沿用旧摄影背景。
- 当前 91 个可见场景中 90 个具备共同云背景，`udo-undama` 海岸保留。隐藏场景继续排除；俯视或室内结构遮住天空时，云自然被遮挡，不把“已接入”写成每个镜头都能看到。

## 来源与文化影响逐场核查

已阅读[场景来源规范](../scene-provenance.md)，对照共同环境、实际夜景实现、各 README 及来源卡中的当前产品呈现。仅调天气布景、色彩与显示层，没有新增文化事实、传统步骤、节期天气或效力主张；日景沿用[既有 85 场核查](2026-11-04-toon-cloud-daylight-expansion.md)。本轮只阅读本地资料，未重新打开外链或升级历史访问状态。

| 场景 | 实际器物与既有操作/语境 | 沿用记录 | 此轮产品新增与边界 |
| --- | --- | --- | --- |
| `brat-bride-cloth` | 双层方布、窗台，保留拿近观察与户外留布的求护民俗语境 | [README](../../packages/scenes/src/brat-bride-cloth/README.md)、[专卡](../../content/traditions/brat-bride-cloth.md) | 远处蓝夜云，不据此断言圣布里吉德节前夜天气或祝福发生 |
| `scottish-first-footing` | 煤礼、门洞、主人炉火，保留午夜后首位来客赠煤祝愿对象 | [README](../../packages/scenes/src/scottish-first-footing/README.md)、[专卡](../../content/traditions/scottish-first-footing.md) | 夜空与云为布景，不变更 First-footing 时间/资格、煤礼身份或主人家庭语境 |
| `diya-oil-lamp` | 三盏陶灯、点灯/旋灯/归盘，沿用本产品对公开献光实践的有限引用 | [README](../../packages/scenes/src/diya-oil-lamp/README.md)、[专卡](../../content/traditions/diya-oil-lamp.md) | 蓝夜云不增加完整仪式、节期、神像或天气含义；三灯与圆轨仍为已记录的产品简化 |
| `votive-candle-catholic` | 蜡烛、石廊烛架，保留点芯、静看/可选文字及天主教献烛祈祷语境 | [README](../../packages/scenes/src/votive-candle-catholic/README.md)、[专卡](../../content/traditions/votive-candle-catholic.md) | 仅露天天空布景，不将宗教祈祷重定义为装饰，不增加天气回应或功效 |
| `yeondeunghoe` | 已成型纸莲灯、点按/上推后的数字上浮意象，保留既有燃灯会文化背景 | [README](../../packages/scenes/src/yeondeunghoe/README.md)、[专卡](../../content/traditions/yeondeunghoe.md) | 夜云不构成圣境或现实放天灯依据，暖光、纸灯与数字意象边界保留 |

上述五场来源 slug、宿主目录、注册表、模块 metadata、标题、技术 ID 和存档均不变；五份 README 和五张专卡同步产品背景变化。没有用云色重建另一套文化背景，也无需改变为 product-original。

原云轮廓函数、Antoine Clappier 署名、原作 URL 与 CC BY-NC-SA 4.0 保留；夜色是本地修改，源码、组件署名及随包环境许可同步。沿用开发者已明确的永久免费意图。

## 验证

- 先运行夜景接入、HDR 不覆盖绘制夜空及夜间时钟冻结回归，旧实现 7 项失败；接入后环境套件 15 文件、241 项通过。
- 真实 WebGL 在直接 ACES 和默认 toon-soft 两条生产路线分别测日夜天空/六层云色、两层两秒漂移及冻结像素。日景天空蓝红通道差约 .65/.46；夜空显示亮度约 .130/.062，夜云从约 .138/.126 逐层升至 .526/.529，保持夜色和层次。
- 昼夜各 24 个尺寸/DPR/时间样本，上沿均为 48～49 CSS 像素；每个样本交换配色后全画布 alpha 逐像素一致。各 18 个独立层上沿/色阶/柔边样本、相机无关性、原横向尺度及辅助深度均通过，控制台/页面错误为零。
- 两日五夜共七个实际场景的手机预览通过，退出合计释放 49 个云资源；风铃、窗布、燃灯会额外检查 320 和 1280 宽度，保留前景遮挡与灯火。油灯和窗布等俯视镜头仍由地面遮住大部分天空；没有为显云改变相机。证据 `artifacts/toon-cloud/day-night-before/`、`day-night-after/`，汇总图 `day-night-preview.png`；浏览器模拟不等于真机。
- 环境套件 241 项、来源内容 37 项、注册表与 metadata 一致性 121 项、scenes 消费端 TypeScript 类型检查、应用构建和 158 场修订指纹通过。编译注释与 Web public/dist、Expo public 中均保留夜色改编署名说明。独立审阅未发现作用域、异步 HDR、颜色管线、时钟/资源或辅助深度问题。

核查清单已逐项对照：实际器物/操作未改、传统与产品边界保留、无新增文化主张或错绑、标题/ID/存档兼容、专卡与 README 同步。技术检查不替代既有文化事实审阅。
