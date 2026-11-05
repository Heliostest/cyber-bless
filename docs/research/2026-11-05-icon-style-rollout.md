# 小物向各自图标风格靠拢

核查日期：2026-11-05。用户认可四件可操作样例后，明确授权继续改进各个小物。本轮正式接入默认 `toon-soft`（保留原技术 ID），覆盖当前目录91项与历史保留67项。

## 实际呈现、来源支持范围与边界

先查看各图标和实际新旧场景画面，再调整显示。图标由产品生成，不能证明传统。通用变化是连续明暗、低强度描边、柔和阴影，以及从对应图标提取色彩锚点后在**原色相不变**的前提下有限幅调明度/饱和度。黑白、低色度、贴图、顶点色及环境不自动参与调色；文字、符号、步骤、数量、信仰解释不变。

既有材料身份由实际实现中的 craft/optics 与原材质声明决定，不从图标颜色推定木种、陶釉、织法或合金。没有新增起源、资格、期限、数量或功效主张。沿用[首批材质记录](2026-11-05-craft-materials.md)、[91场材料逐项记录](2026-11-05-craft-material-rollout.md)、[全场文化核查](2026-10-19-scene-culture-audit.md)及各场 README/来源卡的支持范围。

本次实际阅读了现行规范、共享渲染代码、四件校准实现与相关本地来源正文、既有材料逐场核查，并逐场查看158项实际渲染的覆盖回执及当前91项图像总览。未重新访问文化外链，未通读全部历史卡文化正文；不能将此次材质测试或文档同步视为重新核验外部文化事实。未变的文化主张沿用原记录，保持其有限支持范围、已知缺口及访问状态。

### 四件明确校准

- 御守：源珊瑚/绿/蓝布色向已选图标靠近；封闭袋体轻微鼓起，原装饰和绳结贴合其表面。保持闭合、部件及原创纹样，不增加内部符札或新织法主张。对应[来源卡](../../content/traditions/omamori-cycle.md)和[四件核查](2026-11-05-icon-look-preview.md)。
- 木鱼：真实打包 GLB 的温润木色、源法线/AO和开口深度；不按图标新增垫子、刻字或其他部件。宿主仍使用原来源绑定，器物研究见[木鱼卡](../../content/traditions/mokugyo-wooden-fish.md)，不把交互敲击等同课诵或功德。
- 参拜铃：既有金属色和宽高光校准；裂口、铃眼、木架、三股粗绳与礼敬背景保持。不依据缩略图换成风铃细绳或增加合金/镀金主张。
- 玻璃风铃：原玻璃透射/反射和粉色纸条校准，柔和的掠射角边缘帮助识别薄玻璃；这是产品着色处理，不是新工艺或真实光学模拟保证。不复制图标花纹，保留原装饰环、舌、纸条部件与夏日宗教/工艺说明。

## 实现、状态与资源

- 共用材质适配器仅在 soft 使用 Standard/Physical 连续明暗；保留原图、墨线和其他预设原有规则。每帧从当下源色计算轻调，不冻结完成色、发光或透明动画。环境树木、用户环境 tone 与纸布/水等既有光学仍有各自处理。
- 色彩数据由 `scripts/prepare-icon-style-palettes.mjs` 从158张现有透明图标确定性提取，排除透明边缘、极亮/极暗和低色度像素。源图哈希与七页图标/色彩预览在 artifacts 中。运行时只微调相近色系的 s/l，不移植新的色相含义。
- 材质数组成员、hint、编译特征和源 version 变化使缓存按需失效；贴图引用、法线强度、AO、粗糙度、反射/透射、清漆及衰减值保持实时。透明 Physical 玻璃单独受控克隆，普通水、烟、粒子继续走既有路径。中途失败释放半成品并恢复源材质。
- soft 只暂时缓和定向光与阴影，保留夜色、色温、点光/火焰、用户既有环境调色；正常与异常路径恢复状态。复用现有 HDR 和 composer，不增加独立循环、反射场景或渲染目标。
- 守袋几何只在创建时鼓起一次；试做适配器识别正式几何，避免重复鼓起。源物件、派生材质与贴图所有权分别保留。
- 来源 slug、宿主目录、注册表、模块 metadata、技术 ID、引擎版本、原生标题、存档及完成规则均未变化；README和已有来源卡同步本次产品显示范围。

## 验证与查看

真实基线和新渲染均由同一实际场景入口独立打包后在本地 Chromium/SwiftShader 读取；不启动HTTP服务，不访问外部站点。小物隔离视角用于本轮前后对照；代表完整场景另作兼容检查，工作区同时存在的环境美术工作可能体现在完整场景图中，不将其归作本轮小物变化。桌面结果不等同手机 GPU 测速或真机 WebView 验收。

- 全158项新旧实际截图；新效果逐项切换 original/ink/soft，源材质精确恢复，退出后无活动 WebGL context。
- 当前91项320px逐场渲染，16项完整场景前后检查，12项暗光/夜景检查；均无黑帧、页面/console/shader错误。
- 最终玻璃边缘/透明描边排除对全部3个已声明 glass 的场景补查：小物、完整场景、320px暗光与风格切换均通过；御守闭合修复后补查390/320px与实际拖挂，通过。四件正式场景均经真实浏览器点按/拖动推进（木鱼、选袋并拖至扣环、下拉铃绳、点玻璃铃）。最终画面覆盖的补充回执位于各目录的 `report-glass-final.json` / `report-pouch-final.json`。
- 提交前在独立工作树中补齐2141项本地 LFS 实体，再完整运行 `npm test`，退出码0：包括场景10814项、共享渲染313项、应用1528项，以及其他工作区、木鱼实体/打包资产、反馈夹具和修订生成器。玻璃回归验证派生 Physical 的透射/衰减/透明度/深度/贴图、排除透明描边及最终精确恢复。测试使用独立源码与指向该副本的工作区依赖，不包含同时进行的树木预览改动。
- 根入口 `npm run build`（包括8语言完整性、提取、编译、类型及正式 Vite 构建）和158项修订检查均通过。中文独立对照宿主、CSS和HTML归入 `scripts/`，由专用构建脚本生成本地美术工具，不加入正式 App 页面；未修改翻译检查或增加豁免。重建后四件样例8次真实浏览器渲染通过，零页面/console错误。
- 移动端类型检查和11项DOM/打包守卫测试通过。完整 `mobile:verify` 被既有锁定依赖与 Expo 预期版本不符阻断（`@types/react` 19.3.0 对 ~19.2.4、TypeScript 5.9.3 对 ~6.0.3）；相关 manifest/lock 与基线相同，未改依赖。独立补跑 framework 导出还受到复用第三方依赖 junction 的 Metro 路径解析限制（无法解析 expo），不登记为通过，也不据此宣称移动端打包或真机验收完成。
- 独立只读审阅发现守袋盖边与倒角存在细缝，以及试做材质数组后项构造失败时未释放局部派生材质。均先加入失败回归再修复：高度场在真实盖边的位移/导数为0，倒角不动；克隆立即登记所有权，部分失败释放并删除旧缓存。独立复核312个边界点，最大局部坐标偏差约8.05e-9；两项修复的8个定向测试通过。
- 最终正式 App `tsc -b && vite build`、场景类型检查、158项修订核对通过，仍有既有大 chunk 提示。对照总览经实际浏览器验证91/158/67项筛选、中文搜索、点击放大与320px无横向溢出。

[可搜索前后对照](../../artifacts/icon-style-rollout/index.html)包含全部158件，默认显示当前91件；每张可放大。技术回执、旧新打包与逐场图在 `artifacts/icon-style-rollout/`。本清单是实际显示/实现范围，不能替代独立文化证据。

## 逐场范围

| 场景 | 范围 | 实现已声明的材料类别（不是新增鉴定） | 原来源绑定 |
| --- | --- | --- | --- |
| [七草祈安 / nanakusa-gayu](../../packages/scenes/src/nanakusa-gayu/README.md) | 当前目录 | wood、ceramic、wet | [nanakusa-gayu](../../content/traditions/nanakusa-gayu.md) |
| [窗布祈护 / brat-bride-cloth](../../packages/scenes/src/brat-bride-cloth/README.md) | 当前目录 | stone、wood、fabric | [brat-bride-cloth](../../content/traditions/brat-bride-cloth.md) |
| [鸟竿祈安 / korean-sotdae](../../packages/scenes/src/korean-sotdae/README.md) | 当前目录 | wood | [korean-sotdae](../../content/traditions/korean-sotdae.md) |
| [门松迎岁 / japanese-kadomatsu](../../packages/scenes/src/japanese-kadomatsu/README.md) | 当前目录 | stone、wood、straw、cord、bamboo | [japanese-kadomatsu](../../content/traditions/japanese-kadomatsu.md) |
| [陶牛护家 / pucara-rooftop-bulls](../../packages/scenes/src/pucara-rooftop-bulls/README.md) | 当前目录 | wood、ceramic | [pucara-rooftop-bulls](../../content/traditions/pucara-rooftop-bulls.md) |
| [银锁寄安 / chinese-longevity-lock](../../packages/scenes/src/chinese-longevity-lock/README.md) | 当前目录 | wood、fabric、cord、metal | [chinese-longevity-lock](../../content/traditions/chinese-longevity-lock.md) |
| [振槌寄愿 / uchide-wishing-mallet](../../packages/scenes/src/uchide-wishing-mallet/README.md) | 当前目录 | wood、cord | [uchide-wishing-mallet](../../content/traditions/uchide-wishing-mallet.md) |
| [迪杜赫麦束 / ukrainian-didukh](../../packages/scenes/src/ukrainian-didukh/README.md) | 当前目录 | straw、fabric、wood | [ukrainian-didukh](../../content/traditions/ukrainian-didukh.md) |
| [菩提供水 / sri-lankan-bodhi-puja](../../packages/scenes/src/sri-lankan-bodhi-puja/README.md) | 当前目录 | ceramic、stone | [sri-lankan-bodhi-puja](../../content/traditions/sri-lankan-bodhi-puja.md) |
| [门柱祈安 / mezuzah-doorpost](../../packages/scenes/src/mezuzah-doorpost/README.md) | 当前目录 | metal、wood | [mezuzah-doorpost](../../content/traditions/mezuzah-doorpost.md) |
| [微屋寄愿 / alasita-miniature-house](../../packages/scenes/src/alasita-miniature-house/README.md) | 当前目录 | wood、fabric、metal | [aymara](../../content/traditions/aymara.md) |
| [鱼生捞起 / yusheng-lohei](../../packages/scenes/src/yusheng-lohei/README.md) | 当前目录 | bamboo、fabric、wood、ceramic | [yusheng-lohei](../../content/traditions/yusheng-lohei.md) |
| [抚牛寄愿 / kitano-nadeushi](../../packages/scenes/src/kitano-nadeushi/README.md) | 当前目录 | stone、fabric | [kitano-nadeushi](../../content/traditions/kitano-nadeushi.md) |
| [白线祝归 / lao-baci-wrist](../../packages/scenes/src/lao-baci-wrist/README.md) | 当前目录 | fabric、skin、cord | [lao-baci-phi](../../content/traditions/lao-baci-phi.md) |
| [柳枝祝春 / finnish-virpominen](../../packages/scenes/src/finnish-virpominen/README.md) | 当前目录 | stone、wood、fabric、metal | [finnish-virpominen](../../content/traditions/finnish-virpominen.md) |
| [煤火迎年 / scottish-first-footing](../../packages/scenes/src/scottish-first-footing/README.md) | 当前目录 | stone、wood、metal、fabric | [scottish-first-footing](../../content/traditions/scottish-first-footing.md) |
| [柊鰯守门 / hiiragi-iwashi](../../packages/scenes/src/hiiragi-iwashi/README.md) | 当前目录 | stone、wood | [hiiragi-iwashi](../../content/traditions/hiiragi-iwashi.md) |
| [玉串奉愿 / tamagushi-offering](../../packages/scenes/src/tamagushi-offering/README.md) | 当前目录 | wood、leaf、paper、fabric | [tamagushi-offering](../../content/traditions/tamagushi-offering.md) |
| [清水七供 / tibetan-water-bowls](../../packages/scenes/src/tibetan-water-bowls/README.md) | 当前目录 | wood、metal、water、ceramic | [tibetan-water-bowls](../../content/traditions/tibetan-water-bowls.md) |
| [开樽祝愿 / kagami-biraki-sake](../../packages/scenes/src/kagami-biraki-sake/README.md) | 当前目录 | wood、cord、water、fabric | [kagami-biraki-sake](../../content/traditions/kagami-biraki-sake.md) |
| [经幡迎风 / tibetan-prayer-flags](../../packages/scenes/src/tibetan-prayer-flags/README.md) | 当前目录 | wood、stone、cord、cloth | [tibetan-prayer-flags](../../content/traditions/tibetan-prayer-flags.md) |
| [蘸蜜迎岁 / rosh-hashanah-apple-honey](../../packages/scenes/src/rosh-hashanah-apple-honey/README.md) | 当前目录 | honey、wood、ceramic | [rosh-hashanah-apple-honey](../../content/traditions/rosh-hashanah-apple-honey.md) |
| [浇水敬老 / thai-songkran-elders](../../packages/scenes/src/thai-songkran-elders/README.md) | 当前目录 | wood、fabric、metal、stone、water | [thai-songkran-elders](../../content/traditions/thai-songkran-elders.md) |
| [木鷽迎福 / kameido-usokae](../../packages/scenes/src/kameido-usokae/README.md) | 当前目录 | wood | [kameido-usokae](../../content/traditions/kameido-usokae.md) |
| [熏籽祈安 / persian-esfand](../../packages/scenes/src/persian-esfand/README.md) | 当前目录 | metal、wood、fabric | [persian-esfand](../../content/traditions/persian-esfand.md) |
| [纸雏祈安 / mochigase-nagashibina](../../packages/scenes/src/mochigase-nagashibina/README.md) | 当前目录 | straw、wood、stone | [mochigase-nagashibina](../../content/traditions/mochigase-nagashibina.md) |
| [新岁分糕 / greek-vasilopita](../../packages/scenes/src/greek-vasilopita/README.md) | 当前目录 | wood、ceramic、metal | [greek-vasilopita](../../content/traditions/greek-vasilopita.md) |
| [白绢迎客 / tibetan-khata-greeting](../../packages/scenes/src/tibetan-khata-greeting/README.md) | 当前目录 | stone、fabric、cloth | [tibetan-khata-greeting](../../content/traditions/tibetan-khata-greeting.md) |
| [千岁赠糖 / shichigosan-chitose-ame](../../packages/scenes/src/shichigosan-chitose-ame/README.md) | 当前目录 | stone、cord、fabric | [shichigosan-chitose-ame](../../content/traditions/shichigosan-chitose-ame.md) |
| [敖包祈护 / mongolian-ovoo](../../packages/scenes/src/mongolian-ovoo/README.md) | 当前目录 | stone、wood、fabric | [mongolian-ovoo](../../content/traditions/mongolian-ovoo.md) |
| [浴佛发愿 / fgs-buddha-bathing](../../packages/scenes/src/fgs-buddha-bathing/README.md) | 当前目录 | stone、ceramic、water、wood | [fgs-buddha-bathing](../../content/traditions/fgs-buddha-bathing.md) |
| [叶盘献谢 / balinese-canang-sari](../../packages/scenes/src/balinese-canang-sari/README.md) | 当前目录 | stone、metal | [balinese-canang-sari](../../content/traditions/balinese-canang-sari.md) |
| [彩枝贺年 / bulgarian-survakane](../../packages/scenes/src/bulgarian-survakane/README.md) | 当前目录 | wood、fabric、cord | [bulgarian-survakane](../../content/traditions/bulgarian-survakane.md) |
| [沙塔献幡 / lanna-sand-pagoda](../../packages/scenes/src/lanna-sand-pagoda/README.md) | 当前目录 | bamboo、cord、wood | [lanna-sand-pagoda](../../content/traditions/lanna-sand-pagoda.md) |
| [贴福迎春 / chinese-fu-paper](../../packages/scenes/src/chinese-fu-paper/README.md) | 当前目录 | wood、metal、stone | [chinese-fu-paper](../../content/traditions/chinese-fu-paper.md) |
| [蓝珠祈安 / turkish-nazar-bead](../../packages/scenes/src/turkish-nazar-bead/README.md) | 当前目录 | glass、metal、ceramic、wood、stone | [turkish-nazar-bead](../../content/traditions/turkish-nazar-bead.md) |
| [饰矢祈安 / japanese-hamaya](../../packages/scenes/src/japanese-hamaya/README.md) | 当前目录 | wood、cord、metal、stone | [japanese-hamaya](../../content/traditions/japanese-hamaya.md) |
| [五果迎春 / vietnamese-five-fruit-tray](../../packages/scenes/src/vietnamese-five-fruit-tray/README.md) | 当前目录 | stone、ceramic、wood | [vietnamese-five-fruit-tray](../../content/traditions/vietnamese-five-fruit-tray.md) |
| [如意寄愿 / chinese-ruyi-scepter](../../packages/scenes/src/chinese-ruyi-scepter/README.md) | 当前目录 | jade、stone、wood、fabric | [chinese-ruyi-scepter](../../content/traditions/chinese-ruyi-scepter.md) |
| [熊手纳福 / japanese-kumade](../../packages/scenes/src/japanese-kumade/README.md) | 当前目录 | stone、wood、bamboo | [japanese-kumade](../../content/traditions/japanese-kumade.md) |
| [红角赠福 / neapolitan-cornicello](../../packages/scenes/src/neapolitan-cornicello/README.md) | 当前目录 | stone、wood | [neapolitan-cornicello](../../content/traditions/neapolitan-cornicello.md) |
| [葡萄迎岁 / spanish-twelve-grapes](../../packages/scenes/src/spanish-twelve-grapes/README.md) | 当前目录 | stone、wood、ceramic | [spanish-twelve-grapes](../../content/traditions/spanish-twelve-grapes.md) |
| [蹄铁护家 / horseshoe-doorway-luck](../../packages/scenes/src/horseshoe-doorway-luck/README.md) | 当前目录 | stone、wood、metal | [horseshoe-doorway-luck](../../content/traditions/horseshoe-doorway-luck.md) |
| [节分撒豆 / setsubun-mamemaki](../../packages/scenes/src/setsubun-mamemaki/README.md) | 当前目录 | wood、stone、paper | [setsubun-mamemaki](../../content/traditions/setsubun-mamemaki.md) |
| [门楣祝家 / sternsinger-house-blessing](../../packages/scenes/src/sternsinger-house-blessing/README.md) | 当前目录 | stone、wood、metal | [sternsinger-house-blessing](../../content/traditions/sternsinger-house-blessing.md) |
| [林村抛愿 / lam-tsuen-wishing-tree](../../packages/scenes/src/lam-tsuen-wishing-tree/README.md) | 当前目录 | stone、cord | [lam-tsuen-wishing-tree](../../content/traditions/lam-tsuen-wishing-tree.md) |
| [镜饼迎岁 / kagami-mochi-offering](../../packages/scenes/src/kagami-mochi-offering/README.md) | 当前目录 | wood | [kagami-mochi-offering](../../content/traditions/kagami-mochi-offering.md) |
| [红白寄春 / romanian-martisor](../../packages/scenes/src/romanian-martisor/README.md) | 当前目录 | cord、wood | [romanian-martisor](../../content/traditions/romanian-martisor.md) |
| [三石寄愿 / sumiyoshi-godairiki](../../packages/scenes/src/sumiyoshi-godairiki/README.md) | 当前目录 | fabric、cord、stone | [sumiyoshi-godairiki](../../content/traditions/sumiyoshi-godairiki.md) |
| [薄饼相祝 / polish-oplatek-sharing](../../packages/scenes/src/polish-oplatek-sharing/README.md) | 当前目录 | fabric | [polish-oplatek-sharing](../../content/traditions/polish-oplatek-sharing.md) |
| [破榴迎新 / greek-new-year-pomegranate](../../packages/scenes/src/greek-new-year-pomegranate/README.md) | 当前目录 | fruit、stone、wood、metal | [greek-new-year-pomegranate](../../content/traditions/greek-new-year-pomegranate.md) |
| [椰果献愿 / hindu-coconut-offering](../../packages/scenes/src/hindu-coconut-offering/README.md) | 当前目录 | stone | [hindu-coconut-offering](../../content/traditions/hindu-coconut-offering.md) |
| [栏前结愿 / bonfim-ribbon](../../packages/scenes/src/bonfim-ribbon/README.md) | 当前目录 | metal | [bonfim-ribbon](../../content/traditions/bonfim-ribbon.md) |
| [茅环祈安 / chinowa-kuguri](../../packages/scenes/src/chinowa-kuguri/README.md) | 当前目录 | wood、cord | [chinowa-kuguri](../../content/traditions/chinowa-kuguri.md) |
| [泉水净币 / zeniarai-coin-washing](../../packages/scenes/src/zeniarai-coin-washing/README.md) | 当前目录 | stone、wood、metal、water、fabric | [zeniarai-coin-washing](../../content/traditions/zeniarai-coin-washing.md) |
| [龟岩投愿 / udo-undama](../../packages/scenes/src/udo-undama/README.md) | 当前目录 | stone、ceramic | [udo-undama](../../content/traditions/udo-undama.md) |
| [木槌落片 / japanese-daruma-otoshi](../../packages/scenes/src/japanese-daruma-otoshi/README.md) | 历史保留 | 沿用未指定基材表面 | [japanese-daruma-otoshi](../../content/traditions/japanese-daruma-otoshi.md) |
| [纸翼转风 / paper-pinwheel](../../packages/scenes/src/paper-pinwheel/README.md) | 历史保留 | paper | [paper-pinwheel](../../content/traditions/paper-pinwheel.md) |
| [移砣平衡 / chinese-steelyard](../../packages/scenes/src/chinese-steelyard/README.md) | 历史保留 | 沿用未指定基材表面 | [chinese-steelyard](../../content/traditions/chinese-steelyard.md) |
| [草坪过门 / garden-croquet](../../packages/scenes/src/garden-croquet/README.md) | 历史保留 | 沿用未指定基材表面 | [garden-croquet](../../content/traditions/garden-croquet.md) |
| [悬锤纺线 / welsh-drop-spindle](../../packages/scenes/src/welsh-drop-spindle/README.md) | 历史保留 | 沿用未指定基材表面 | [welsh-drop-spindle](../../content/traditions/welsh-drop-spindle.md) |
| [木杆搅乳 / scottish-plunge-churn](../../packages/scenes/src/scottish-plunge-churn/README.md) | 历史保留 | 沿用未指定基材表面 | [scottish-plunge-churn](../../content/traditions/scottish-plunge-churn.md) |
| [鼓面轻拍 / irish-bodhran](../../packages/scenes/src/irish-bodhran/README.md) | 历史保留 | skin | [irish-bodhran](../../content/traditions/irish-bodhran.md) |
| [手磨晨光 / french-coffee-mill](../../packages/scenes/src/french-coffee-mill/README.md) | 历史保留 | 沿用未指定基材表面 | [french-coffee-mill](../../content/traditions/french-coffee-mill.md) |
| [纸伞舒晴 / japanese-wagasa](../../packages/scenes/src/japanese-wagasa/README.md) | 历史保留 | paper | [japanese-wagasa](../../content/traditions/japanese-wagasa.md) |
| [木壳轻拍 / spanish-castanets](../../packages/scenes/src/spanish-castanets/README.md) | 历史保留 | 沿用未指定基材表面 | [spanish-castanets](../../content/traditions/spanish-castanets.md) |
| [竹筒叩石 / japanese-shishi-odoshi](../../packages/scenes/src/japanese-shishi-odoshi/README.md) | 历史保留 | 沿用未指定基材表面 | [japanese-shishi-odoshi](../../content/traditions/japanese-shishi-odoshi.md) |
| [牵绳木偶 / german-jumping-jack](../../packages/scenes/src/german-jumping-jack/README.md) | 历史保留 | 沿用未指定基材表面 | [german-jumping-jack](../../content/traditions/german-jumping-jack.md) |
| [五弦轻拨 / finnish-kantele](../../packages/scenes/src/finnish-kantele/README.md) | 历史保留 | 沿用未指定基材表面 | [finnish-kantele](../../content/traditions/finnish-kantele.md) |
| [秋千轻荡 / estonian-village-swing](../../packages/scenes/src/estonian-village-swing/README.md) | 历史保留 | 沿用未指定基材表面 | [estonian-village-swing](../../content/traditions/estonian-village-swing.md) |
| [银球近靶 / french-petanque](../../packages/scenes/src/french-petanque/README.md) | 历史保留 | 沿用未指定基材表面 | [french-petanque](../../content/traditions/french-petanque.md) |
| [风囊轻送 / english-hearth-bellows](../../packages/scenes/src/english-hearth-bellows/README.md) | 历史保留 | 沿用未指定基材表面 | [english-hearth-bellows](../../content/traditions/english-hearth-bellows.md) |
| [石面磨香 / mexican-metate](../../packages/scenes/src/mexican-metate/README.md) | 历史保留 | 沿用未指定基材表面 | [mexican-metate](../../content/traditions/mexican-metate.md) |
| [木齿轻转 / czech-wooden-ratchet](../../packages/scenes/src/czech-wooden-ratchet/README.md) | 历史保留 | 沿用未指定基材表面 | [czech-wooden-ratchet](../../content/traditions/czech-wooden-ratchet.md) |
| [瓜棱轻奏 / puerto-rican-guiro](../../packages/scenes/src/puerto-rican-guiro/README.md) | 历史保留 | 沿用未指定基材表面 | [puerto-rican-guiro](../../content/traditions/puerto-rican-guiro.md) |
| [折扇轻风 / valencian-folding-fan](../../packages/scenes/src/valencian-folding-fan/README.md) | 历史保留 | cloth | [valencian-folding-fan](../../content/traditions/valencian-folding-fan.md) |
| [木压成圆 / mexican-tortilla-press](../../packages/scenes/src/mexican-tortilla-press/README.md) | 历史保留 | 沿用未指定基材表面 | [mexican-tortilla-press](../../content/traditions/mexican-tortilla-press.md) |
| [木窝播籽 / ghanaian-oware](../../packages/scenes/src/ghanaian-oware/README.md) | 历史保留 | 沿用未指定基材表面 | [ghanaian-oware](../../content/traditions/ghanaian-oware.md) |
| [拨浪轻响 / chinese-rattle-drum](../../packages/scenes/src/chinese-rattle-drum/README.md) | 历史保留 | 沿用未指定基材表面 | [chinese-rattle-drum](../../content/traditions/chinese-rattle-drum.md) |
| [七巧归方 / chinese-tangram](../../packages/scenes/src/chinese-tangram/README.md) | 历史保留 | 沿用未指定基材表面 | [chinese-tangram](../../content/traditions/chinese-tangram.md) |
| [空竹轻扬 / chinese-diabolo](../../packages/scenes/src/chinese-diabolo/README.md) | 历史保留 | 沿用未指定基材表面 | [chinese-diabolo](../../content/traditions/chinese-diabolo.md) |
| [木柶行棋 / korean-yutnori](../../packages/scenes/src/korean-yutnori/README.md) | 历史保留 | 沿用未指定基材表面 | [korean-yutnori](../../content/traditions/korean-yutnori.md) |
| [套娃相藏 / russian-matryoshka](../../packages/scenes/src/russian-matryoshka/README.md) | 历史保留 | 沿用未指定基材表面 | [russian-matryoshka](../../content/traditions/russian-matryoshka.md) |
| [鲤旗迎风 / japanese-koinobori](../../packages/scenes/src/japanese-koinobori/README.md) | 当前目录 | wood、metal、cord、cloth | [japanese-koinobori](../../content/traditions/japanese-koinobori.md) |
| [剑玉轻接 / japanese-kendama](../../packages/scenes/src/japanese-kendama/README.md) | 历史保留 | 沿用未指定基材表面 | [japanese-kendama-craft](../../content/traditions/japanese-kendama-craft.md) |
| [棉线慢成 / indian-charkha](../../packages/scenes/src/indian-charkha/README.md) | 历史保留 | 沿用未指定基材表面 | [indian-charkha-craft](../../content/traditions/indian-charkha-craft.md) |
| [木偶开果 / german-nutcracker](../../packages/scenes/src/german-nutcracker/README.md) | 历史保留 | 沿用未指定基材表面 | [erzgebirge-nutcracker-craft](../../content/traditions/erzgebirge-nutcracker-craft.md) |
| [木旋起沫 / mexican-molinillo](../../packages/scenes/src/mexican-molinillo/README.md) | 历史保留 | 沿用未指定基材表面 | [molinillo-chocolate-craft](../../content/traditions/molinillo-chocolate-craft.md) |
| [铁舌轻鸣 / malawi-sansi](../../packages/scenes/src/malawi-sansi/README.md) | 历史保留 | 沿用未指定基材表面 | [mbira-sansi-craft](../../content/traditions/mbira-sansi-craft.md) |
| [拨珠见数 / chinese-suanpan](../../packages/scenes/src/chinese-suanpan/README.md) | 历史保留 | 沿用未指定基材表面 | [chinese-zhusuan](../../content/traditions/chinese-zhusuan.md) |
| [毡屋向阳 / mongolian-felt-ger](../../packages/scenes/src/mongolian-felt-ger/README.md) | 历史保留 | 沿用未指定基材表面 | [mongolian-ger-craft](../../content/traditions/mongolian-ger-craft.md) |
| [葫芦刻光 / peruvian-engraved-gourd](../../packages/scenes/src/peruvian-engraved-gourd/README.md) | 历史保留 | 沿用未指定基材表面 | [peruvian-mate-burilado](../../content/traditions/peruvian-mate-burilado.md) |
| [玻珠凝彩 / venetian-glass-bead](../../packages/scenes/src/venetian-glass-bead/README.md) | 历史保留 | glass | [italian-glass-beads](../../content/traditions/italian-glass-beads.md) |
| [方巾裹礼 / korean-bojagi-wrap](../../packages/scenes/src/korean-bojagi-wrap/README.md) | 当前目录 | fabric、cloth | [korean-bojagi](../../content/traditions/korean-bojagi.md) |
| [竹蜓点风 / vietnamese-bamboo-dragonfly](../../packages/scenes/src/vietnamese-bamboo-dragonfly/README.md) | 历史保留 | 沿用未指定基材表面 | [thach-xa-bamboo-dragonfly](../../content/traditions/thach-xa-bamboo-dragonfly.md) |
| [浮彩成笺 / turkish-ebru-paper](../../packages/scenes/src/turkish-ebru-paper/README.md) | 历史保留 | water | [turkish-ebru](../../content/traditions/turkish-ebru.md) |
| [竹音轻摇 / indonesian-angklung](../../packages/scenes/src/indonesian-angklung/README.md) | 历史保留 | 沿用未指定基材表面 | [indonesian-angklung](../../content/traditions/indonesian-angklung.md) |
| [纸鸢乘风 / weifang-paper-kite](../../packages/scenes/src/weifang-paper-kite/README.md) | 历史保留 | paper | [weifang-kite-craft](../../content/traditions/weifang-kite-craft.md) |
| [影偶小戏 / chinese-shadow-puppet](../../packages/scenes/src/chinese-shadow-puppet/README.md) | 历史保留 | 沿用未指定基材表面 | [chinese-shadow-puppet](../../content/traditions/chinese-shadow-puppet.md) |
| [毛线织暖 / faroese-wool-knit](../../packages/scenes/src/faroese-wool-knit/README.md) | 历史保留 | 沿用未指定基材表面 | [faroese-wool-knitting](../../content/traditions/faroese-wool-knitting.md) |
| [贝链留光 / niue-shell-necklace](../../packages/scenes/src/niue-shell-necklace/README.md) | 历史保留 | 沿用未指定基材表面 | [niue-kahoa-hihi](../../content/traditions/niue-kahoa-hihi.md) |
| [剪纸开花 / polish-paper-cut](../../packages/scenes/src/polish-paper-cut/README.md) | 历史保留 | 沿用未指定基材表面 | [polish-wycinanki](../../content/traditions/polish-wycinanki.md) |
| [陶轮慢成 / uzbek-clay-bowl](../../packages/scenes/src/uzbek-clay-bowl/README.md) | 历史保留 | 沿用未指定基材表面 | [uzbek-ceramic-craft](../../content/traditions/uzbek-ceramic-craft.md) |
| [木版留春 / chinese-woodblock-print](../../packages/scenes/src/chinese-woodblock-print/README.md) | 历史保留 | paper | [chinese-woodblock-print](../../content/traditions/chinese-woodblock-print.md) |
| [珠星映光 / czech-bead-star](../../packages/scenes/src/czech-bead-star/README.md) | 历史保留 | 沿用未指定基材表面 | [czech-glass-bead-ornaments](../../content/traditions/czech-glass-bead-ornaments.md) |
| [叶扇纳凉 / fijian-woven-fan](../../packages/scenes/src/fijian-woven-fan/README.md) | 历史保留 | 沿用未指定基材表面 | [fijian-iri-fan](../../content/traditions/fijian-iri-fan.md) |
| [织毯寄暖 / amazigh-woven-rug](../../packages/scenes/src/amazigh-woven-rug/README.md) | 历史保留 | 沿用未指定基材表面 | [moroccan-amazigh-textiles](../../content/traditions/moroccan-amazigh-textiles.md) |
| [铁线栖鸟 / slovak-wire-bird](../../packages/scenes/src/slovak-wire-bird/README.md) | 历史保留 | 沿用未指定基材表面 | [slovak-wire-craft](../../content/traditions/slovak-wire-craft.md) |
| [花绣寄语 / hungarian-embroidery-hoop](../../packages/scenes/src/hungarian-embroidery-hoop/README.md) | 历史保留 | cloth | [hungarian-embroidery](../../content/traditions/hungarian-embroidery.md) |
| [釉彩映晴 / andalusian-ceramic-tile](../../packages/scenes/src/andalusian-ceramic-tile/README.md) | 历史保留 | 沿用未指定基材表面 | [andalusian-ceramic-tile](../../content/traditions/andalusian-ceramic-tile.md) |
| [彩车迎晴 / sicilian-painted-cart](../../packages/scenes/src/sicilian-painted-cart/README.md) | 历史保留 | 沿用未指定基材表面 | [sicilian-carretto-craft](../../content/traditions/sicilian-carretto-craft.md) |
| [蓝白晾晴 / bai-indigo-cloth](../../packages/scenes/src/bai-indigo-cloth/README.md) | 历史保留 | water | [bai-tie-dye](../../content/traditions/bai-tie-dye.md) |
| [彩墙寄家 / ndebele-painted-house](../../packages/scenes/src/ndebele-painted-house/README.md) | 历史保留 | 沿用未指定基材表面 | [ndebele-wall-painting](../../content/traditions/ndebele-wall-painting.md) |
| [铜碗拾暖 / purepecha-copper-bowl](../../packages/scenes/src/purepecha-copper-bowl/README.md) | 历史保留 | 沿用未指定基材表面 | [santa-clara-copper-craft](../../content/traditions/santa-clara-copper-craft.md) |
| [木勺寄情 / welsh-love-spoon](../../packages/scenes/src/welsh-love-spoon/README.md) | 当前目录 | fabric、wood | [welsh-love-spoons](../../content/traditions/welsh-love-spoons.md) |
| [陶鸡报晓 / barcelos-clay-rooster](../../packages/scenes/src/barcelos-clay-rooster/README.md) | 当前目录 | ceramic | [barcelos-clay-rooster](../../content/traditions/barcelos-clay-rooster.md) |
| [桦篮拾光 / finnish-birch-basket](../../packages/scenes/src/finnish-birch-basket/README.md) | 历史保留 | 沿用未指定基材表面 | [finnish-birch-bark-craft](../../content/traditions/finnish-birch-bark-craft.md) |
| [彩心相赠 / croatian-licitar-heart](../../packages/scenes/src/croatian-licitar-heart/README.md) | 当前目录 | fabric、wood | [croatian-licitar](../../content/traditions/croatian-licitar.md) |
| [巨偶待游 / catalan-festival-giant](../../packages/scenes/src/catalan-festival-giant/README.md) | 历史保留 | 沿用未指定基材表面 | [catalan-gegants](../../content/traditions/catalan-gegants.md) |
| [彩蛋寄春 / sorbian-painted-egg](../../packages/scenes/src/sorbian-painted-egg/README.md) | 当前目录 | fabric、ceramic、wood、metal | [sorbian-easter-eggs](../../content/traditions/sorbian-easter-eggs.md) |
| [太阳花迎门 / basque-sunflower](../../packages/scenes/src/basque-sunflower/README.md) | 当前目录 | stone、wood、paper、cord | [basque-eguzkilore](../../content/traditions/basque-eguzkilore.md) |
| [节旗轻展 / breton-banner](../../packages/scenes/src/breton-banner/README.md) | 历史保留 | cloth | [breton-pardons](../../content/traditions/breton-pardons.md) |
| [草穗悬园 / lithuanian-straw-garden](../../packages/scenes/src/lithuanian-straw-garden/README.md) | 当前目录 | wood、cord、straw、fabric | [lithuanian-straw-gardens](../../content/traditions/lithuanian-straw-gardens.md) |
| [木马安放 / dalarna-wooden-horse](../../packages/scenes/src/dalarna-wooden-horse/README.md) | 历史保留 | 沿用未指定基材表面 | [dalarna-wooden-horse](../../content/traditions/dalarna-wooden-horse.md) |
| [舟模寄谢 / aland-votive-ship](../../packages/scenes/src/aland-votive-ship/README.md) | 当前目录 | fabric、wood、metal、cord、cloth | [aland-votive-ship](../../content/traditions/aland-votive-ship.md) |
| [茶山一盏 / blang-tea](../../packages/scenes/src/blang-tea/README.md) | 历史保留 | tea | [jingmai-tea-forest](../../content/traditions/jingmai-tea-forest.md) |
| [木陀轻转 / minangkabau-spinning-top](../../packages/scenes/src/minangkabau-spinning-top/README.md) | 历史保留 | 沿用未指定基材表面 | 无传统绑定（现状） |
| [炉前一炷 / chinese-incense](../../packages/scenes/src/chinese-incense/README.md) | 当前目录 | wood、fabric、ceramic、bamboo、tea | [chinese-incense](../../content/traditions/chinese-incense.md) |
| [红绳自持 / hongsheng-red-string](../../packages/scenes/src/hongsheng-red-string/README.md) | 历史保留 | 沿用未指定基材表面 | 无传统绑定（现状） |
| [绘牌记谢 / italian-ex-voto](../../packages/scenes/src/italian-ex-voto/README.md) | 当前目录 | wood、ceramic、metal、fabric | [italian-ex-voto](../../content/traditions/italian-ex-voto.md) |
| [旅途一页 / czech-pilgrim-journal](../../packages/scenes/src/czech-pilgrim-journal/README.md) | 历史保留 | tea | 无传统绑定（现状） |
| [签纸慢读 / omikuji](../../packages/scenes/src/omikuji/README.md) | 当前目录 | wood | [omikuji](../../content/traditions/omikuji.md) |
| [一篮春食 / polish-blessing-basket](../../packages/scenes/src/polish-blessing-basket/README.md) | 当前目录 | wood、fabric、cord | [polish-folk-catholic](../../content/traditions/polish-folk-catholic.md) |
| [春锅共煮 / navruz-sumalak](../../packages/scenes/src/navruz-sumalak/README.md) | 当前目录 | wood、metal、wet、fabric、ceramic | [uzbek-sumalak-cooking](../../content/traditions/uzbek-sumalak-cooking.md) |
| [叶舟寄意 / floating-lantern-loy-krathong](../../packages/scenes/src/floating-lantern-loy-krathong/README.md) | 当前目录 | wood | [floating-lantern-loy-krathong](../../content/traditions/floating-lantern-loy-krathong.md) |
| [御守伴行 / omamori-cycle](../../packages/scenes/src/omamori-cycle/README.md) | 当前目录 | wood、fabric、cord | [omamori-cycle](../../content/traditions/omamori-cycle.md) |
| [庭前一铃 / shrine-suzu-bell](../../packages/scenes/src/shrine-suzu-bell/README.md) | 当前目录 | wood、metal、cord | [shrine-suzu-bell](../../content/traditions/shrine-suzu-bell.md) |
| [草编迎春 / st-brigids-cross](../../packages/scenes/src/st-brigids-cross/README.md) | 当前目录 | wood、cord | [st-brigids-cross](../../content/traditions/st-brigids-cross.md) |
| [竹筛迎岁 / bokjori](../../packages/scenes/src/bokjori/README.md) | 当前目录 | wood、bamboo、cord | [bokjori](../../content/traditions/bokjori.md) |
| [木牌记愿 / ema-votive-plaque](../../packages/scenes/src/ema-votive-plaque/README.md) | 当前目录 | wood、cord | [ema-votive-plaque](../../content/traditions/ema-votive-plaque.md) |
| [井边放下 / clootie-well-rag](../../packages/scenes/src/clootie-well-rag/README.md) | 当前目录 | stone、water、fabric | [clootie-well-rag](../../content/traditions/clootie-well-rag.md) |
| [灯旋一瞥 / diya-oil-lamp](../../packages/scenes/src/diya-oil-lamp/README.md) | 当前目录 | ceramic、wet、cord | [diya-oil-lamp](../../content/traditions/diya-oil-lamp.md) |
| [留一盏烛光 / votive-candle-catholic](../../packages/scenes/src/votive-candle-catholic/README.md) | 当前目录 | stone、metal、wax | [votive-candle-catholic](../../content/traditions/votive-candle-catholic.md) |
| [达摩点睛 / daruma-eye-painting](../../packages/scenes/src/daruma-eye-painting/README.md) | 当前目录 | wood | [daruma-eye-painting](../../content/traditions/daruma-eye-painting.md) |
| [水引结愿 / mizuhiki](../../packages/scenes/src/mizuhiki/README.md) | 当前目录 | cord | [mizuhiki](../../content/traditions/mizuhiki.md) |
| [留一枚感谢 / milagros](../../packages/scenes/src/milagros/README.md) | 当前目录 | wood、metal | [milagros](../../content/traditions/milagros.md) |
| [串花寄意 / phuang-malai](../../packages/scenes/src/phuang-malai/README.md) | 当前目录 | cord | [phuang-malai](../../content/traditions/phuang-malai.md) |
| [敲一敲木鱼 / woodfish](../../assets/woodfish/README.md) | 当前目录 | wood | [chinese-buddhism](../../content/traditions/chinese-buddhism.md) |
| [泉边一念 / celtic-folk-spring](../../packages/scenes/src/celtic-folk-spring/README.md) | 历史保留 | 沿用未指定基材表面 | 无传统绑定（现状） |
| [花水位一倾 / theravada-water](../../packages/scenes/src/theravada-water/README.md) | 历史保留 | water | 无传统绑定（现状） |
| [短册系竹 / tanzaku-tanabata](../../packages/scenes/src/tanzaku-tanabata/README.md) | 当前目录 | bamboo、paper | [tanzaku-tanabata](../../content/traditions/tanzaku-tanabata.md) |
| [燃灯上浮 / yeondeunghoe](../../packages/scenes/src/yeondeunghoe/README.md) | 当前目录 | paper | [yeondeunghoe](../../content/traditions/yeondeunghoe.md) |
| [风铃一响 / furin-wind-chime](../../packages/scenes/src/furin-wind-chime/README.md) | 当前目录 | wood、cord、glass | [furin-wind-chime](../../content/traditions/furin-wind-chime.md) |
| [庭前一礼 / shinto-torii](../../packages/scenes/src/shinto-torii/README.md) | 当前目录 | stone、wood | [shinto](../../content/traditions/shinto.md) |
| [廊前轻转 / tibetan-wheel](../../packages/scenes/src/tibetan-wheel/README.md) | 当前目录 | metal | [tibetan-buddhism](../../content/traditions/tibetan-buddhism.md) |
| [火边花环 / slavic-wreath](../../packages/scenes/src/slavic-wreath/README.md) | 当前目录 | wood | [kupala-wreath](../../content/traditions/kupala-wreath.md) |
| [折一只纸鹤 / crane](../../packages/scenes/src/crane/README.md) | 当前目录 | paper | [origami-crane-senbazuru](../../content/traditions/origami-crane-senbazuru.md) |
| [月下一灯 / lantern](../../packages/scenes/src/lantern/README.md) | 历史保留 | paper | 无传统绑定（现状） |

## 规范核查

- [x] 实际器物/材料/动作与完成条件已对照，变化明确归于产品美术；无从图标反推传统。
- [x] 无新增文化身份、工艺、寓意、规则或功效；继承证据支持范围与本轮外链访问状态如实记录。
- [x] 无换卡或地区索引式绑定，真实宗教背景保持，未改写为装饰/自省。
- [x] README/源卡同步产品范围；宿主、注册表、metadata、标题、ID与存档未变。
- [x] 最终技术测试、构建、实际画面和交互完成；与文化支持范围审阅分别报告。
