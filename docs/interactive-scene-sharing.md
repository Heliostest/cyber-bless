# 本地互动场景分享页

当前完成本地功能，不包含公网部署。分享消息发送的是互动网页链接和 App Store 链接；接收者点击网页后，在浏览器里操作真实 Three.js 场景。社交消息本身不内嵌运行 Three.js。

## 本地打开

在仓库根目录运行：

```powershell
npm.cmd run dev
```

Vite 默认端口为 5173。打开：

```text
http://localhost:5173/share.html?v=1&scene=woodfish&lang=zh-Hans
http://localhost:5173/share.html?v=1&scene=crane&lang=zh-Hans&style=gouache
```

支持的场景来自 App 的可见内置目录，语言和 shader 来自现有白名单。初始静音，点「开启声音」后可发声；「重新体验」重置当前网页的体验。网页不读取 App 私人存档，也不保存心愿或奖励。

App 中完成一场体验后，点「分享仪式」→「预览互动场景」也可在本机打开对应页面。本机网址不作为公开链接发送；没有配置公开网址时保留图片分享和 App Store 入口，并提示互动链接尚未开放。

## 预览生产构建

```powershell
npm.cmd run build -w @wbr/cyber-bless
npm.cmd run preview -w @wbr/cyber-bless -- --host 127.0.0.1 --port 5187 --strictPort
```

然后打开 `http://127.0.0.1:5187/share.html?v=1&scene=woodfish&lang=zh-Hans`。运行预览的终端按 Ctrl+C 可停止。

## 公开网址以后接入

部署 `apps/cyber-bless/dist/` 后，按实际域名设置：

- Web 构建环境：`VITE_PUBLIC_SHARE_BASE_URL`。
- Expo 构建环境：`EXPO_PUBLIC_SHARE_BASE_URL`。

两者填写同一公开 HTTPS 站点根地址或子目录地址。只配置真实已部署地址；localhost、内网、示例或占位域名不会启用对外链接分享。变量在构建时进入应用，修改后需重建对应 Web／App。

若托管于站点子目录，还需将 Web 构建的 `VITE_BASE_PATH` 设为对应绝对路径（开头和结尾均为 `/`）；此路径用于 Vite 静态资源以及模型、HDR 等正式场景资源。`VITE_PUBLIC_SHARE_BASE_URL` 应指向同一子目录。部署时同时保留 `index.html`、`share.html`、`assets/`、模型、环境和其他静态资源，不需要为分享页添加单页应用路径重写。

页面和分享文案中的 App Store URL 固定对应本应用配置的 ID `6821271597`，常量位于 `packages/core/src/scene-share.ts`。没有根据外部参数改变商店目标。此入口不保证当前所有地区已上架；本轮未提交审核或发布应用。

## 实现与验证

- 分享契约：`packages/core/src/scene-share.ts`。
- 独立网页：`packages/app/src/public-scene.tsx`、`apps/cyber-bless/share.html`。
- App 分享面板：`packages/app/src/ritual-share.tsx`。
- 原生链接桥：`apps/mobile-expo/share-link.ts`，使用 React Native 系统分享。
- 浏览器验收：构建后运行 `node scripts/verify-interactive-sharing.mjs`；使用本地生产文件验证真实木鱼、纸鹤、shader、交互、静音、重玩、App Store href、手机宽度和存档隔离。

文化影响、验证结果及限制见[整合记录](research/2026-10-28-interactive-scene-sharing.md)。
