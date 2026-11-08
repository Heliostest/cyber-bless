# Mac mini iOS 发布入口

正式发布使用 **远端附注 tag → Mac 获取 Git/LFS → 同版本工具构建**。不再生成或接受“HEAD 加当前工作区”的 `source.tgz`。沿用已有 Expo 原生生成、主应用／小组件签名、离线资源检查和 ASC 内部组。

## 提交并固定发布输入

1. 用现有商店状态入口核对 ASC 已用编号，更新 `store/ios/release-input.json` 的版本、构建号与工具链。当前仅用 Xcode 构建，`syncEasCounter:false`，不要求 EAS 登录。只有继续混用 EAS 构建时，才同时核对 EAS 占用并开启计数同步。初始 `buildNumber:null` 故意阻止未分配的新发布。
2. 审阅并提交本次业务源码、素材、全部发布工具、`package-lock.json`、`Gemfile`／`Gemfile.lock`、`store/ios/Podfile.lock`。不笼统提交其他任务的工作。
3. 合并 `master`，验证准确的合并提交，包含项目规定检查及 `npm run ios:release:test`。检查后再修改输入，就重新提交、验证。
4. 推送代码和 LFS 后创建附注 tag。下列 **19 仅是命名示例，不代表编号已分配**：

```bash
git push origin master
git lfs push origin master
git tag -a ios-v1.0.0-build.19 master -m "iOS 1.0.0 build 19"
git push origin refs/tags/ios-v1.0.0-build.19
```

来源必须在远端 `master` 历史中；不能改分支参数绕过。入口比较 tag 对象、commit/tree，拒绝不存在或移动的 tag。`master` 后续推进不影响旧 tag 重建。

`release-input.json` 中的 `internalUpdates` 是冻结的原生分发决定，必须为布尔值，缺省按 `false` 兼容历史输入。正式包保持 `false`。指定内测接入包需要审阅并提交 `internalUpdates:true`，同时源码内测总开关必须开启；不能用机器配置或 SSH 环境临时开启。runner、资产准备、prebuild、Pods 和 Xcode 归档统一从该字段设置 `EXPO_INTERNAL_UPDATES=0|1`，实际求值的非公开 Expo 配置检查及各阶段回执必须与其一致。完整求值配置只在内存中检查，日志仅保存模式、runtime 策略和签名 key ID。安装包中的 `X-Feedback-Token` 仅为空字符串占位符，真实邀请码由手机运行时覆盖；不得把邀请码写入冻结输入或原生配置。内测使用真实 fingerprint runtime，新增原生依赖、桥或证书会改变兼容身份；此前未包含接入能力的原生包必须先换装，新包后再验证 A→B→回退→断网启动。

## Mac 获取与配置

Git LFS 3.8.1 已安装。非交互 SSH 显式使用现有工具路径；后续版本以已提交 release input 为准。在 Mac shell 中：

```bash
export PATH="/Users/heli/.nvm/versions/node/v24.12.0/bin:/Users/heli/.rbenv/versions/3.2.0/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export DEVELOPER_DIR="/Applications/Xcode-26.6.0.app/Contents/Developer"
release_root=/Users/heli/ios-builds/cyber-bless
mkdir -p "$release_root"
```

首次建立只获取工具的 bootstrap checkout，后续沿用，不覆盖已有目录：

```bash
GIT_LFS_SKIP_SMUDGE=1 git clone https://github.com/Heliostest/cyber-bless.git "$release_root/bootstrap"
node "$release_root/bootstrap/scripts/ios-release/checkout-tag.mjs" --tag=ios-v1.0.0-build.19 --root="$release_root" > "$release_root/source.json"
release_repo=$(node -p 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).repo' "$release_root/source.json")
```

Bootstrap 只获取和验证源码。后续必须执行返回的 `release_repo` 内工具，不能继续使用 bootstrap 的构建脚本。未知／脏目录会被拒绝，不执行 reset／clean。源码路径采用编码 tag，不自行拼接。

在构建根目录保存 `machine.json`，只放机器路径、已有内部组和测试说明，不放秘密值：

```json
{
  "nodeBinary": "/Users/heli/.nvm/versions/node/v24.12.0/bin/node",
  "rubyBinary": "/Users/heli/.rbenv/versions/3.2.0/bin/ruby",
  "developerDir": "/Applications/Xcode-26.6.0.app/Contents/Developer",
  "privateDir": "/Users/heli/.wbr/testflight-20261026",
  "groupId": "沿用本 App 已有内部组 ID",
  "whatToTest": "本次实际改动的测试说明"
}
```

```bash
node "$release_repo/scripts/ios-release/release-runner.mjs" configure "$release_root/source.json" "$release_root/machine.json"
```

输出实际配置路径，位于 `<release_repo>/artifacts/ios-release/<buildNumber>/release-config.json`。配置来自 tag 中的 release input；同一轮配置不能被不同输入覆盖。

## 串行发布阶段

把下列 `<配置绝对路径>` 换为 configure 输出：

```bash
node "$release_repo/scripts/ios-release/release-runner.mjs" <配置绝对路径> build
node "$release_repo/scripts/ios-release/release-runner.mjs" <配置绝对路径> upload
node "$release_repo/scripts/ios-release/release-runner.mjs" <配置绝对路径> finish
```

- `build`：ASC 编号检查 → prepare → EAS 计数／活动构建检查（混用时）→ archive/export → offline verify。不会上传；先安装依赖再调用 EAS SDK。
- `prepare`：核对实际工具链，`npm ci`，从干净原生目录生成工程，按冻结 Bundler 和 Podfile.lock 执行 deployment 安装；先执行不签名的 Release 构建，让官方脚本完成预编译依赖切换与模块 provider 生成，再重放生成工程中的 Expo dSYM 映射阶段，最后记录原生输入。首次构建的映射阶段可能早于依赖切换，因此必须在 Release 框架就位后再次执行。失败使旧成功准备回执失效。
- `upload`：重新核对源码、原生输入、验证器、签名包和回执，按原有保护上传一次。
- `finish`：查询同一包，必要时更新测试说明。`pending:true` 表示需要合理间隔继续查询，不能重传包。
- `status` 只读查询 ASC。仅在 `syncEasCounter:true`、混用 EAS 构建时执行 `counter-status`／`counter-sync`；后者必须在同源 TestFlight 完成回执核验后同步 EAS 计数。仅 Xcode 发布不执行这两个 EAS 阶段。
- `rebuild`：按旧 tag 只准备、归档和验证，不要求新编号、不上传、不更改计数。不会覆盖已有产物。

所有阶段都必须通过 runner 持有本 App 独占锁。不要直接调用阶段脚本。异常留下 `.release.lock` 时先核对进程状态，不自动抢锁。归档成功但导出失败时，先查日志；确需重新归档，应先把该轮 IPA／archive／回执保全到本 App 构建根内的明确历史目录，再处理该轮已生成目录，不能盲目重跑或删除其他发布。

Xcode 归档、签名、上传 ASC 和内部 TestFlight 分发均不依赖 EAS 认证。当前按 ASC 分配构建号，EAS 远端计数不再回写；本机 Expo 原生工程生成和离线资源准备照常执行。

以后若恢复混用 EAS 构建，先核对 ASC 与 EAS 的实际占用及活动构建，选择未用编号，把 `syncEasCounter:true` 提交并使用新 tag。此时 Mac 才需要登录现有 Expo 账号或通过安全环境注入 `EXPO_TOKEN`；不能依赖 Windows 的本机会话。不要把 token 写入 Git、machine.json 或日志。冻结 tag 的计数策略不能就地改写。

## 固定输入与存储

工具核对同一个 tag、commit/tree、文件哈希、原生编译输入和阶段回执。脚本或源码有修复时提交并使用新 tag。原生 iOS 仍由 prebuild 生成；升级依赖先更新跟踪的锁，不关闭 frozen／deployment 检查放行。

新发布 tag 使用不含斜杠与百分号的名称，例如 `ios-v1.0.0-build.20`。含斜杠的 tag 会生成含 `%2F` 的 checkout 目录；已在本机复现 Xcode Clang 缓存工具无法写入该目录。旧失败 tag 和回执保留，不移动或覆盖。

Pods 安装通过同一提交内的 `pod-install.rb` 调用 CocoaPods。ExpoModulesCore 和 ExpoWidgets 的本地 podspec JSON 含 checkout 绝对路径；包装器仅在这两个保存的 JSON 校验和中，将本 checkout 的完整路径前缀（含 URI 转义形式）规范为固定占位符，避免编码 tag 目录改变锁。版本、依赖、脚本及其他字节仍参与校验，实际原生路径仍完整记录在原生输入回执中。安装继续使用冻结 Bundler 和 `--deployment`，并逐字节核对跟踪锁。更新 `store/ios/Podfile.lock` 时也必须使用该包装器；在独立验证 checkout 的 `apps/mobile-expo/ios` 中运行 `bundle exec ruby ../../../scripts/ios-release/pod-install.rb install` 生成候选锁后，验证 `install --deployment` 与目录迁移均不改变锁，再审阅提交。

小型 manifest、工具链、IPA 哈希及上传回执用于追溯。源码和脚本已经在 Git/LFS 后，不再另外存大型源码压缩包；各 tag checkout 当前各有 Git/LFS／依赖缓存，结束后不要无限保留所有工作目录。需要安装或排查旧包时保全其 IPA／archive／dSYM，再清理旧 checkout。本工具不自动删除历史备份。

旧构建 18 等工作区快照保持原有事实，不追认成 tag 构建。tag 固定输入并支持重建，不承诺重新签名的 IPA 字节一致。
