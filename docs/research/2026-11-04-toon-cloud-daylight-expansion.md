# Toon Cloud 共享日景扩展核查

后续布局更新：按用户要求将云上沿固定到距场景画布顶部 72 CSS 像素，见[固定视口间距记录](2026-11-04-toon-cloud-viewport-anchor.md)。下文的适用范围和文化核查继续有效，旧截图中的世界坐标云位不代表最终布局。

日期：2026-11-04（Asia/Shanghai）。承接[首次移植与许可核查](2026-11-04-toon-cloud-background.md)，按用户“其他的场景呢”的后续要求扩展。

## 最终范围与实际呈现

App 当前 91 个可见场景中，85 个白天共享环境接入远景云带：49 个庭院、15 个花园、18 个廊台、1 个桌面、2 个河岸环境。只对 App 可见场景启用；隐藏历史场景、收藏中的纯物件展示不增加云。

以下六场保留原背景：`brat-bride-cloth`、`scottish-first-footing`、`diya-oil-lamp`、`votive-candle-catholic`、`yeondeunghoe` 为夜景；`udo-undama` 为特殊海岸环境。不改变它们的昼夜、灯光、海岸布局或来源。

远景云仍采用首次移植的六层圆润轮廓、淡蓝白配色、低云位和缓慢漂移；不为显示云改变相机、器物位置、动作或交互空间。镜头露出天空时云可见；木鱼等俯视镜头下，地面自然遮住天空中的云。不能把“已具备共享云背景”表述为每个镜头都能看见云。

## 文化影响与同步记录

本次代码只扩展共同背景的适用条件。既有器物/材料/部件、动作、对象、场合、完成条件、介绍/提示及文化归属没有改动。云不是传统云纹、地域景观复原、节庆天气、神圣境域或效力表达。各场宗教礼敬、占卜、祈愿与纪念背景保留其原有说法，不被改写成纯装饰或自省。

本次沿用每场 README 与来源卡已有的文化核查，不登记外部文化材料为本日重新读过；当前技术变化未产生需要新增文化证据的主张。下方逐场表指向既有记录。新增 82 场的 README 和对应来源卡同步记录背景变化，首次三场沿用已补的记录；宿主目录、注册表与模块 metadata 的身份/来源字段不修改，并通过既有一致性测试核对。没有因背景云而改为 `product-original`，技术 ID、引擎与存档兼容性不变。

署名、许可与本地作品来源读取状态沿用首次核查；`@license` 编译注释和随包环境许可继续保留。开发者已明确永久免费、无付费解锁，不重启已回答的许可问题。

## 验证

环境回归先确认原来只接入三场时，全 App 日景覆盖用例失败，再扩展适用条件。最终结果：

- `@wbr/scene-runtime` 全套 14 文件、237 项通过，覆盖 85 场完整日景与夜景/海岸/隐藏场景的排除、暂停/减少动态/预览时钟和资源释放。
- 来源内容 37 项、App 可见性 7 项、场景注册表与 metadata 121 项通过；模块身份和来源绑定一致。
- `npm run build` 通过，保留原有大 chunk 警告；`scene:revisions:check` 检查 158 场通过。压缩 JS 的署名和 Web dist / Web public / Expo public 三处许可输出均验证保留。
- 浏览器实际访问全部 91 个可见场景：85 场分别挂载六层云，6 场没有云；85 次退出分别释放一个几何和六个材质，共 595 个资源释放事件。减少动态时间保持为零，没有页面或控制台错误。
- 全部 91 场保留 390×844 浏览器画面；十个代表场景另查 320×844 与 1280×900，覆盖五种环境、低角度与俯视镜头。人工查看四张全场景联系表及代表场景大图，未见云裁切、主体覆盖或操作提示被遮挡。桌面和手机尺寸均为浏览器模拟，并非真机验证。
- 独立审阅未发现新增代码、适用范围或来源问题；85 行目录及 171 个本地记录链接有效，170 份场景/来源文档的既有内容保持。

证据：`artifacts/toon-cloud/expanded/report.json`、逐场 PNG、`expansion-sheet-1.png` 至 `expansion-sheet-4.png` 和各测试/构建日志；新增场景总览为 `expanded-preview.png`。本轮未进行原生构建、提交或发布。

## 逐场既有记录

<!-- daylight-inventory -->

| 场景 ID / 标题 | 环境 | 既有场景核查 | 沿用来源卡 |
| --- | --- | --- | --- |
| `nanakusa-gayu` / 七草祈安 | 庭院 | [README](../../packages/scenes/src/nanakusa-gayu/README.md) | [nanakusa-gayu](../../content/traditions/nanakusa-gayu.md) |
| `korean-sotdae` / 鸟竿祈安 | 庭院 | [README](../../packages/scenes/src/korean-sotdae/README.md) | [korean-sotdae](../../content/traditions/korean-sotdae.md) |
| `japanese-kadomatsu` / 门松迎岁 | 庭院 | [README](../../packages/scenes/src/japanese-kadomatsu/README.md) | [japanese-kadomatsu](../../content/traditions/japanese-kadomatsu.md) |
| `pucara-rooftop-bulls` / 陶牛护家 | 庭院 | [README](../../packages/scenes/src/pucara-rooftop-bulls/README.md) | [pucara-rooftop-bulls](../../content/traditions/pucara-rooftop-bulls.md) |
| `chinese-longevity-lock` / 银锁寄安 | 庭院 | [README](../../packages/scenes/src/chinese-longevity-lock/README.md) | [chinese-longevity-lock](../../content/traditions/chinese-longevity-lock.md) |
| `uchide-wishing-mallet` / 振槌寄愿 | 庭院 | [README](../../packages/scenes/src/uchide-wishing-mallet/README.md) | [uchide-wishing-mallet](../../content/traditions/uchide-wishing-mallet.md) |
| `ukrainian-didukh` / 迪杜赫麦束 | 庭院 | [README](../../packages/scenes/src/ukrainian-didukh/README.md) | [ukrainian-didukh](../../content/traditions/ukrainian-didukh.md) |
| `sri-lankan-bodhi-puja` / 菩提供水 | 花园 | [README](../../packages/scenes/src/sri-lankan-bodhi-puja/README.md) | [sri-lankan-bodhi-puja](../../content/traditions/sri-lankan-bodhi-puja.md) |
| `mezuzah-doorpost` / 门柱祈安 | 庭院 | [README](../../packages/scenes/src/mezuzah-doorpost/README.md) | [mezuzah-doorpost](../../content/traditions/mezuzah-doorpost.md) |
| `alasita-miniature-house` / 微屋寄愿 | 庭院 | [README](../../packages/scenes/src/alasita-miniature-house/README.md) | [aymara](../../content/traditions/aymara.md) |
| `yusheng-lohei` / 鱼生捞起 | 花园 | [README](../../packages/scenes/src/yusheng-lohei/README.md) | [yusheng-lohei](../../content/traditions/yusheng-lohei.md) |
| `kitano-nadeushi` / 抚牛寄愿 | 花园 | [README](../../packages/scenes/src/kitano-nadeushi/README.md) | [kitano-nadeushi](../../content/traditions/kitano-nadeushi.md) |
| `lao-baci-wrist` / 白线祝归 | 庭院 | [README](../../packages/scenes/src/lao-baci-wrist/README.md) | [lao-baci-phi](../../content/traditions/lao-baci-phi.md) |
| `finnish-virpominen` / 柳枝祝春 | 庭院 | [README](../../packages/scenes/src/finnish-virpominen/README.md) | [finnish-virpominen](../../content/traditions/finnish-virpominen.md) |
| `hiiragi-iwashi` / 柊鰯守门 | 花园 | [README](../../packages/scenes/src/hiiragi-iwashi/README.md) | [hiiragi-iwashi](../../content/traditions/hiiragi-iwashi.md) |
| `tamagushi-offering` / 玉串奉愿 | 庭院 | [README](../../packages/scenes/src/tamagushi-offering/README.md) | [tamagushi-offering](../../content/traditions/tamagushi-offering.md) |
| `tibetan-water-bowls` / 清水七供 | 花园 | [README](../../packages/scenes/src/tibetan-water-bowls/README.md) | [tibetan-water-bowls](../../content/traditions/tibetan-water-bowls.md) |
| `kagami-biraki-sake` / 开樽祝愿 | 花园 | [README](../../packages/scenes/src/kagami-biraki-sake/README.md) | [kagami-biraki-sake](../../content/traditions/kagami-biraki-sake.md) |
| `tibetan-prayer-flags` / 经幡迎风 | 庭院 | [README](../../packages/scenes/src/tibetan-prayer-flags/README.md) | [tibetan-prayer-flags](../../content/traditions/tibetan-prayer-flags.md) |
| `rosh-hashanah-apple-honey` / 蘸蜜迎岁 | 花园 | [README](../../packages/scenes/src/rosh-hashanah-apple-honey/README.md) | [rosh-hashanah-apple-honey](../../content/traditions/rosh-hashanah-apple-honey.md) |
| `thai-songkran-elders` / 浇水敬老 | 庭院 | [README](../../packages/scenes/src/thai-songkran-elders/README.md) | [thai-songkran-elders](../../content/traditions/thai-songkran-elders.md) |
| `kameido-usokae` / 木鷽迎福 | 花园 | [README](../../packages/scenes/src/kameido-usokae/README.md) | [kameido-usokae](../../content/traditions/kameido-usokae.md) |
| `persian-esfand` / 熏籽祈安 | 庭院 | [README](../../packages/scenes/src/persian-esfand/README.md) | [persian-esfand](../../content/traditions/persian-esfand.md) |
| `mochigase-nagashibina` / 纸雏祈安 | 花园 | [README](../../packages/scenes/src/mochigase-nagashibina/README.md) | [mochigase-nagashibina](../../content/traditions/mochigase-nagashibina.md) |
| `greek-vasilopita` / 新岁分糕 | 庭院 | [README](../../packages/scenes/src/greek-vasilopita/README.md) | [greek-vasilopita](../../content/traditions/greek-vasilopita.md) |
| `tibetan-khata-greeting` / 白绢迎客 | 花园 | [README](../../packages/scenes/src/tibetan-khata-greeting/README.md) | [tibetan-khata-greeting](../../content/traditions/tibetan-khata-greeting.md) |
| `shichigosan-chitose-ame` / 千岁赠糖 | 庭院 | [README](../../packages/scenes/src/shichigosan-chitose-ame/README.md) | [shichigosan-chitose-ame](../../content/traditions/shichigosan-chitose-ame.md) |
| `mongolian-ovoo` / 敖包祈护 | 花园 | [README](../../packages/scenes/src/mongolian-ovoo/README.md) | [mongolian-ovoo](../../content/traditions/mongolian-ovoo.md) |
| `fgs-buddha-bathing` / 浴佛发愿 | 庭院 | [README](../../packages/scenes/src/fgs-buddha-bathing/README.md) | [fgs-buddha-bathing](../../content/traditions/fgs-buddha-bathing.md) |
| `balinese-canang-sari` / 叶盘献谢 | 庭院 | [README](../../packages/scenes/src/balinese-canang-sari/README.md) | [balinese-canang-sari](../../content/traditions/balinese-canang-sari.md) |
| `bulgarian-survakane` / 彩枝贺年 | 庭院 | [README](../../packages/scenes/src/bulgarian-survakane/README.md) | [bulgarian-survakane](../../content/traditions/bulgarian-survakane.md) |
| `lanna-sand-pagoda` / 沙塔献幡 | 庭院 | [README](../../packages/scenes/src/lanna-sand-pagoda/README.md) | [lanna-sand-pagoda](../../content/traditions/lanna-sand-pagoda.md) |
| `chinese-fu-paper` / 贴福迎春 | 庭院 | [README](../../packages/scenes/src/chinese-fu-paper/README.md) | [chinese-fu-paper](../../content/traditions/chinese-fu-paper.md) |
| `turkish-nazar-bead` / 蓝珠祈安 | 庭院 | [README](../../packages/scenes/src/turkish-nazar-bead/README.md) | [turkish-nazar-bead](../../content/traditions/turkish-nazar-bead.md) |
| `japanese-hamaya` / 饰矢祈安 | 庭院 | [README](../../packages/scenes/src/japanese-hamaya/README.md) | [japanese-hamaya](../../content/traditions/japanese-hamaya.md) |
| `vietnamese-five-fruit-tray` / 五果迎春 | 庭院 | [README](../../packages/scenes/src/vietnamese-five-fruit-tray/README.md) | [vietnamese-five-fruit-tray](../../content/traditions/vietnamese-five-fruit-tray.md) |
| `chinese-ruyi-scepter` / 如意寄愿 | 庭院 | [README](../../packages/scenes/src/chinese-ruyi-scepter/README.md) | [chinese-ruyi-scepter](../../content/traditions/chinese-ruyi-scepter.md) |
| `japanese-kumade` / 熊手纳福 | 庭院 | [README](../../packages/scenes/src/japanese-kumade/README.md) | [japanese-kumade](../../content/traditions/japanese-kumade.md) |
| `neapolitan-cornicello` / 红角赠福 | 庭院 | [README](../../packages/scenes/src/neapolitan-cornicello/README.md) | [neapolitan-cornicello](../../content/traditions/neapolitan-cornicello.md) |
| `spanish-twelve-grapes` / 葡萄迎岁 | 庭院 | [README](../../packages/scenes/src/spanish-twelve-grapes/README.md) | [spanish-twelve-grapes](../../content/traditions/spanish-twelve-grapes.md) |
| `horseshoe-doorway-luck` / 蹄铁护家 | 庭院 | [README](../../packages/scenes/src/horseshoe-doorway-luck/README.md) | [horseshoe-doorway-luck](../../content/traditions/horseshoe-doorway-luck.md) |
| `setsubun-mamemaki` / 节分撒豆 | 庭院 | [README](../../packages/scenes/src/setsubun-mamemaki/README.md) | [setsubun-mamemaki](../../content/traditions/setsubun-mamemaki.md) |
| `sternsinger-house-blessing` / 门楣祝家 | 庭院 | [README](../../packages/scenes/src/sternsinger-house-blessing/README.md) | [sternsinger-house-blessing](../../content/traditions/sternsinger-house-blessing.md) |
| `lam-tsuen-wishing-tree` / 林村抛愿 | 庭院 | [README](../../packages/scenes/src/lam-tsuen-wishing-tree/README.md) | [lam-tsuen-wishing-tree](../../content/traditions/lam-tsuen-wishing-tree.md) |
| `kagami-mochi-offering` / 镜饼迎岁 | 庭院 | [README](../../packages/scenes/src/kagami-mochi-offering/README.md) | [kagami-mochi-offering](../../content/traditions/kagami-mochi-offering.md) |
| `romanian-martisor` / 红白寄春 | 庭院 | [README](../../packages/scenes/src/romanian-martisor/README.md) | [romanian-martisor](../../content/traditions/romanian-martisor.md) |
| `sumiyoshi-godairiki` / 三石寄愿 | 庭院 | [README](../../packages/scenes/src/sumiyoshi-godairiki/README.md) | [sumiyoshi-godairiki](../../content/traditions/sumiyoshi-godairiki.md) |
| `polish-oplatek-sharing` / 薄饼相祝 | 庭院 | [README](../../packages/scenes/src/polish-oplatek-sharing/README.md) | [polish-oplatek-sharing](../../content/traditions/polish-oplatek-sharing.md) |
| `greek-new-year-pomegranate` / 破榴迎新 | 庭院 | [README](../../packages/scenes/src/greek-new-year-pomegranate/README.md) | [greek-new-year-pomegranate](../../content/traditions/greek-new-year-pomegranate.md) |
| `hindu-coconut-offering` / 椰果献愿 | 庭院 | [README](../../packages/scenes/src/hindu-coconut-offering/README.md) | [hindu-coconut-offering](../../content/traditions/hindu-coconut-offering.md) |
| `bonfim-ribbon` / 栏前结愿 | 庭院 | [README](../../packages/scenes/src/bonfim-ribbon/README.md) | [bonfim-ribbon](../../content/traditions/bonfim-ribbon.md) |
| `chinowa-kuguri` / 茅环祈安 | 庭院 | [README](../../packages/scenes/src/chinowa-kuguri/README.md) | [chinowa-kuguri](../../content/traditions/chinowa-kuguri.md) |
| `zeniarai-coin-washing` / 泉水净币 | 庭院 | [README](../../packages/scenes/src/zeniarai-coin-washing/README.md) | [zeniarai-coin-washing](../../content/traditions/zeniarai-coin-washing.md) |
| `japanese-koinobori` / 鲤旗迎风 | 花园 | [README](../../packages/scenes/src/japanese-koinobori/README.md) | [japanese-koinobori](../../content/traditions/japanese-koinobori.md) |
| `korean-bojagi-wrap` / 方巾裹礼 | 廊台 | [README](../../packages/scenes/src/korean-bojagi-wrap/README.md) | [korean-bojagi](../../content/traditions/korean-bojagi.md) |
| `welsh-love-spoon` / 木勺寄情 | 廊台 | [README](../../packages/scenes/src/welsh-love-spoon/README.md) | [welsh-love-spoons](../../content/traditions/welsh-love-spoons.md) |
| `barcelos-clay-rooster` / 陶鸡报晓 | 廊台 | [README](../../packages/scenes/src/barcelos-clay-rooster/README.md) | [barcelos-clay-rooster](../../content/traditions/barcelos-clay-rooster.md) |
| `croatian-licitar-heart` / 彩心相赠 | 庭院 | [README](../../packages/scenes/src/croatian-licitar-heart/README.md) | [croatian-licitar](../../content/traditions/croatian-licitar.md) |
| `sorbian-painted-egg` / 彩蛋寄春 | 廊台 | [README](../../packages/scenes/src/sorbian-painted-egg/README.md) | [sorbian-easter-eggs](../../content/traditions/sorbian-easter-eggs.md) |
| `basque-sunflower` / 太阳花迎门 | 庭院 | [README](../../packages/scenes/src/basque-sunflower/README.md) | [basque-eguzkilore](../../content/traditions/basque-eguzkilore.md) |
| `lithuanian-straw-garden` / 草穗悬园 | 廊台 | [README](../../packages/scenes/src/lithuanian-straw-garden/README.md) | [lithuanian-straw-gardens](../../content/traditions/lithuanian-straw-gardens.md) |
| `aland-votive-ship` / 舟模寄谢 | 廊台 | [README](../../packages/scenes/src/aland-votive-ship/README.md) | [aland-votive-ship](../../content/traditions/aland-votive-ship.md) |
| `chinese-incense` / 炉前一炷 | 庭院 | [README](../../packages/scenes/src/chinese-incense/README.md) | [chinese-incense](../../content/traditions/chinese-incense.md) |
| `italian-ex-voto` / 绘牌记谢 | 廊台 | [README](../../packages/scenes/src/italian-ex-voto/README.md) | [italian-ex-voto](../../content/traditions/italian-ex-voto.md) |
| `omikuji` / 签纸慢读 | 庭院 | [README](../../packages/scenes/src/omikuji/README.md) | [omikuji](../../content/traditions/omikuji.md) |
| `polish-blessing-basket` / 一篮春食 | 廊台 | [README](../../packages/scenes/src/polish-blessing-basket/README.md) | [polish-folk-catholic](../../content/traditions/polish-folk-catholic.md) |
| `navruz-sumalak` / 春锅共煮 | 庭院 | [README](../../packages/scenes/src/navruz-sumalak/README.md) | [uzbek-sumalak-cooking](../../content/traditions/uzbek-sumalak-cooking.md) |
| `floating-lantern-loy-krathong` / 叶舟寄意 | 河岸 | [README](../../packages/scenes/src/floating-lantern-loy-krathong/README.md) | [floating-lantern-loy-krathong](../../content/traditions/floating-lantern-loy-krathong.md) |
| `omamori-cycle` / 御守伴行 | 廊台 | [README](../../packages/scenes/src/omamori-cycle/README.md) | [omamori-cycle](../../content/traditions/omamori-cycle.md) |
| `shrine-suzu-bell` / 庭前一铃 | 庭院 | [README](../../packages/scenes/src/shrine-suzu-bell/README.md) | [shrine-suzu-bell](../../content/traditions/shrine-suzu-bell.md) |
| `st-brigids-cross` / 草编迎春 | 廊台 | [README](../../packages/scenes/src/st-brigids-cross/README.md) | [st-brigids-cross](../../content/traditions/st-brigids-cross.md) |
| `bokjori` / 竹筛迎岁 | 廊台 | [README](../../packages/scenes/src/bokjori/README.md) | [bokjori](../../content/traditions/bokjori.md) |
| `ema-votive-plaque` / 木牌记愿 | 廊台 | [README](../../packages/scenes/src/ema-votive-plaque/README.md) | [ema-votive-plaque](../../content/traditions/ema-votive-plaque.md) |
| `clootie-well-rag` / 井边放下 | 花园 | [README](../../packages/scenes/src/clootie-well-rag/README.md) | [clootie-well-rag](../../content/traditions/clootie-well-rag.md) |
| `daruma-eye-painting` / 达摩点睛 | 廊台 | [README](../../packages/scenes/src/daruma-eye-painting/README.md) | [daruma-eye-painting](../../content/traditions/daruma-eye-painting.md) |
| `mizuhiki` / 水引结愿 | 廊台 | [README](../../packages/scenes/src/mizuhiki/README.md) | [mizuhiki](../../content/traditions/mizuhiki.md) |
| `milagros` / 留一枚感谢 | 廊台 | [README](../../packages/scenes/src/milagros/README.md) | [milagros](../../content/traditions/milagros.md) |
| `phuang-malai` / 串花寄意 | 花园 | [README](../../packages/scenes/src/phuang-malai/README.md) | [phuang-malai](../../content/traditions/phuang-malai.md) |
| `woodfish` / 敲一敲木鱼 | 廊台 | [README](../../packages/app/src/woodfish/README.md) | [chinese-buddhism](../../content/traditions/chinese-buddhism.md) |
| `tanzaku-tanabata` / 短册系竹 | 花园 | [README](../../packages/scenes/src/tanzaku-tanabata/README.md) | [tanzaku-tanabata](../../content/traditions/tanzaku-tanabata.md) |
| `furin-wind-chime` / 风铃一响 | 廊台 | [README](../../packages/scenes/src/furin-wind-chime/README.md) | [furin-wind-chime](../../content/traditions/furin-wind-chime.md) |
| `shinto-torii` / 庭前一礼 | 庭院 | [README](../../packages/scenes/src/shinto-torii/README.md) | [shinto](../../content/traditions/shinto.md) |
| `tibetan-wheel` / 廊前轻转 | 廊台 | [README](../../packages/scenes/src/tibetan-wheel/README.md) | [tibetan-buddhism](../../content/traditions/tibetan-buddhism.md) |
| `slavic-wreath` / 火边花环 | 河岸 | [README](../../packages/scenes/src/slavic-wreath/README.md) | [kupala-wreath](../../content/traditions/kupala-wreath.md) |
| `crane` / 折一只纸鹤 | 桌面 | [README](../../packages/scenes/src/crane/README.md) | [origami-crane-senbazuru](../../content/traditions/origami-crane-senbazuru.md) |
