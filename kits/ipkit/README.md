# weblink-ipkit

基于 **Vite + Vue 3 + TypeScript + Naive UI** 的浏览器内网络协议调试台：HTTP（fetch）、WebSocket、DNS over HTTPS（dns-json）、WebTransport 握手探测。与 [weblink](https://weblink.pages.dev) 其它 kit 相同，需在**安全上下文**（HTTPS 或 localhost）下使用。

## 功能

| 模块             | 说明                                                                      |
| ---------------- | ------------------------------------------------------------------------- |
| **HTTP**         | 自定义方法、URL、请求头与 body；展示状态、响应头、截断后的 body、耗时摘要 |
| **WebSocket**    | 连接 wss/ws、收发文本、消息日志                                           |
| **DoH**          | 使用 Cloudflare / Google 公共解析器的 `application/dns-json` GET          |
| **WebTransport** | 对 HTTPS 端点尝试 `WebTransport` 握手（成功后关闭）                       |

## 浏览器支持

- 推荐 **Chrome / Edge**（Chromium）：能力最全。
- **Firefox / Safari**：fetch、WebSocket、DoH 通常可用；WebTransport 依版本而定。

## 限制（重要）

浏览器**无法**提供 ICMP（ping）、任意 UDP/TCP 原始套接字、抓包等与系统级 IP 栈等价的调试；详见 [docs/limitations.md](docs/limitations.md)。跨域与访问内网设备还受 **CORS** 与 **Private Network Access** 等策略约束。

## 开发

```bash
npm install
npm run dev
```

```bash
npm run build
npm run test
npm run lint
npm run format
```

## 部署（Cloudflare Pages）

- **构建命令**：`npm run build`
- **输出目录**：`dist`
- **Node**：20 LTS 或与本地一致

静态资源根目录下的 [`public/_headers`](public/_headers) 会在发布时写入 HTTP 头，用于 **允许被 weblink `/kits` 以 iframe 嵌入**。

当前策略包含：

| 父页面场景 | 说明 |
|------------|------|
| `https://weblink.pages.dev` | 生产环境主站 |
| `https://*.weblink.pages.dev` | Cloudflare Pages 的预览部署（含分支/PR） |
| `http://localhost:5173` 等 | 本地开发 weblink（Vite 默认端口及常见预览端口） |
| `'self'` | 直接打开 ipkit 本站 |

若你为 weblink 绑定了**自定义域名**，请在 `_headers` 的 `frame-ancestors` 中追加该域名的 `https://…` 源（与 weblink 主站文档中的 CSP 示例一致），重新部署 ipkit 后即可从该域名下的 weblink 嵌入。

## 主站聚合

在 weblink 仓库的 `kitModules` 中配置本站点 URL 后，即可在 `/kits` 内 iframe 打开；目标站点须允许被嵌入（见 weblink README）。

## 许可

与 monorepo 内其它 weblink 项目保持一致（若未单独声明，以仓库根目录 LICENSE 为准）。
