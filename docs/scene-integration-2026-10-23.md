# 20个已验收场景分支集成

本轮2026-10-23启动、2026-10-24完成，基线`2750df59b5357a375b2d69483b2832bd668fc4fd`。用户明确授权合并并推送。固定本次开始时已验收的20分支；不包含仍在开发的振槌场景。两个LFS迁移前、与现主线无共同祖先的历史分支保留，不引入其旧代码和大文件历史。全部历史分支、工作区及原预览记录保留，不恢复定时任务。

- `codex/kitano-nadeushi` / `01e1433d6776dcc03c03b1eeeba3d979549faf28`：抚牛寄愿。
- `codex/lao-baci-wrist` / `a4048992cb52447421e636edcc689d5bc5f8b11c`：白线祝归。
- `codex/finnish-virpominen` / `bd3d466590b7992f42f6acd1534dc922fc12312d`：柳枝祝春。
- `codex/scottish-first-footing` / `9dbd5bdf750ac1b1f4d04701973fd463a5317bdd`：煤火迎年。
- `codex/lanna-sand-pagoda` / `5276026a74adf564aa5c13c523011d2b211bb0ce`：沙塔献幡。
- `codex/chinese-fu-paper` / `3c8ea3f86c62a9a536480ac7611bb1c0324b9507`：贴福迎春。
- `codex/nanakusa-gayu` / `513612adf0075740983bc90ae7293b894b7ad321`：七草祈安。
- `codex/turkish-nazar-bead` / `22a4638dd1f16b59e91a41e207f89ac4f6af4918`：蓝珠祈安。
- `codex/brat-bride-cloth` / `a3d52458bfaafc930c6c9ab376fa4301ee6108cb`：窗布祈护。
- `codex/japanese-hamaya` / `3ce48997ac83cbfb7e458b8ef8cbfd21f72b4eac`：饰矢祈安。
- `codex/korean-sotdae` / `a5eb915556fafa86a74ce50906f6c4c95c510824`：鸟竿祈安。
- `codex/vietnamese-five-fruit-tray` / `c5fae25bd796bf6fbf5b43ac10c36af86e5dbacf`：五果迎春。
- `codex/chinese-ruyi-scepter` / `c36a2a99bc502afd977ec2eae0c8deb607d5b11c`：如意寄愿。
- `codex/japanese-kadomatsu` / `b3341839c0a64895a47b933d5be7ae9b898c8dcd`：门松迎岁。
- `codex/japanese-kumade` / `c4313c738d2f61cf4ed3ffe378d3ba7526fab28c`：熊手纳福。
- `codex/pucara-rooftop-bulls` / `e4ae3c41beaf3cd77f254473a12f21503d6c2d29`：陶牛护家。
- `codex/neapolitan-cornicello` / `489c21d857b8ef78ab7cf2ea9948d42d3790ccfc`：红角赠福。
- `codex/spanish-twelve-grapes` / `e55fc1818467eaa8af34bf50aeb0a4c1afe687ee`：葡萄迎岁。
- `codex/chinese-longevity-lock` / `0a3f7a0444c554bdbbe70776db7bcecb0715bbb1`：银锁寄安。
- `codex/horseshoe-doorway-luck` / `1dc17103c64132626b8227ec8c78001305e811e5`：蹄铁护家。

本轮仅技术集成：20模块的产品源码与README、对应来源卡与研究保持原验收提交，旧主线界面和隐藏67项保留；不增加或改写器物、材质、造型、动作、信仰与文化事实。来源卡、研究和原验收记录已逐场复读，继续沿用其正文实际访问状态，不把本轮技术检查冒称重新读取外部来源。独立逐场核对见artifacts/integrate-scenes-20261023/independent-provenance-review.md。

共享目录/metadata/engine/intention/narrative/icon/environment/map/widget按条目并集汇总，最终153个唯一场景、86可见、67隐藏；WISH与旧隐藏项顺序不变。新增20进入BLESSING，原生153条标题类别及459张（153×3尺寸）源图和Android副本对应。

合并修复：三个共享验证脚本恢复单一目录或手势实现；原Scottish测试实际使用import.meta.glob，增加vite/client ambient类型声明，原测试文件不动；README新设无序20来源入口，旧86条漏项已恢复并重新核对旧1—749项。另将Scottish旧测试的无效手势样例对齐当前主线容错：跨轴2倍、大幅回退到.25；新增三个测试验证小幅.7回调和3倍继续释放可接受。该项改变仅限scene.test.ts，不改共享手势实现或产品行为。先实际观察6失败，再定向Scottish/helper共78项通过，完整套件重新执行。未删除测试或回退新界面。

最终验证：裸npm test八包合计10166通过、退出0（56/11/1025/54/3/8838/37/142）。Web构建、移动类型、guard、Expo依赖、小组件与Android/iOS离线导出全通过。20场景在鼠标320/390/1280px及390px CDP触摸模拟中共80组实际三步操作、160张截图，errors/external均空；本轮集成浏览器流程使用减少动画模式，不冒称重做全部普通速度动画验收；不称真机或原生Swift/Kotlin编译。根查看三张代表截图，不冒称人工审了全部160图。

独立静态主/补检查5818+777项通过；Scottish兼容性另核128模块中127原blob、唯一测试例外合理，README旧1—749条补核无缺失。来源/技术审阅分别记录。最终运行证据签核与本地/远端HEAD记录在artifacts/integrate-scenes-20261023/；新生产预览5425保留旧预览。

来源核查清单：实际器物/材料/动作与原验收不变；文化主张无新增；绑定/文字保持原范围；原专卡/研究/README复读并记录访问限制；宿主/registry/meta/原生标题同步；场景池及67隐藏政策保留；技术检查与来源审阅分开。只在本轮用户授权范围合并和推送，不恢复定时开发。
