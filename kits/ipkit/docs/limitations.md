# 浏览器内网络调试的能力边界

weblink-ipkit 仅使用标准 Web API，**不**附带本机代理或浏览器扩展，因此与桌面端网络工具（Wireshark、`ping`、`dig` 原始 UDP 等）能力不同。

## 无法做到的事情

- **ICMP**：无法 ping、traceroute。
- **任意 TCP/UDP 端口**：无法像 `nc` 一样连接任意主机端口（除非目标协议恰好通过 `fetch` / `WebSocket` / `WebTransport` 暴露）。
- **原始 IP 或以太网帧**：无法抓包。
- **本地网段广播 / mDNS**：无通用 Web API。
- **系统 DNS 缓存与解析链**：DoH 工具仅向**你选择的 HTTPS 端点**发起查询，不代表系统解析器行为。

## 会遇到的策略限制

- **CORS**：对第三方域名的 `fetch` / DoH 请求需对方响应正确的 `Access-Control-*` 头。
- **Private Network Access（原 CORS-RFC1918）**：从公网页面访问 `http://192.168.x.x` 等可能触发额外预检或失败。
- **混合内容**：HTTPS 页面无法请求明文 HTTP（浏览器会拦截）。

## 与 webrtckit 的分工

- **WebRTC**（ICE、STUN/TURN、DataChannel、mesh 信令）请使用 **webrtckit**。
- **ipkit** 聚焦 HTTP、WebSocket、DoH、WebTransport 等可在页面内直接发起的协议实验。
