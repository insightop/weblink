# weblink-gnsskit

GNSS Kit，浏览器通过 **Web Serial** 连接模块，解析并展示 NMEA 数据。

## 技术栈

- Vite
- 原生 JavaScript（入口：`index.html` → `src/main.js`，逻辑在 `src/gnss/`）
- Chart.js（GSV 小图）、nmea-simple（解析）

## 目录结构（单页）

```text
index.html              # 站点根路径 / 的唯一入口
vite.config.js
vitest.config.mjs
src/
  main.js               # 启动：串口、NMEA 管线、布局
  styles/
    base.css            # 全局布局与组件基样式（原 styles.css）
  gnss/
    constants.js        # 波特率、缓冲等常量
    state.js            # 页面状态
    serial.js           # Web Serial
    pipeline.js         # NMEA 行缓冲与快照
    ui.js               # 解析卡片与原始区渲染
    gnss-page.css       # GNSS 页局部样式
    pipeline.test.js
  modules/              # 跨页面复用（当前仅 GNSS 使用）
  utils/                # NMEA 解析、格式化等
```

## 开发

**首次克隆后必须先安装依赖**（否则会出现 `Cannot find module 'vite'`）：

```bash
cd weblink-gnsskit
npm install
npm run dev
```

`npm run dev` 会**一直运行**（终端里持续输出日志），这是正常现象；停止开发时在终端按 **Ctrl+C** 即可，不是卡死。

开发服务器根路径即为应用首页，例如：

`http://localhost:5173/`（若 5173 已被占用，终端里会打印实际端口，例如 `5174`）

请使用 **Chrome / Edge** 等支持 Web Serial 的浏览器，且需 **HTTPS 或 localhost**。

## 构建

```bash
npm run build
```

静态产物在 `dist/`。

## 测试

```bash
npm test
```

## 参考

- [Web Serial API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API)
- [NMEA 0183](https://en.wikipedia.org/wiki/NMEA_0183)
