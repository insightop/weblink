# ota-kit-shell 规格（delta）

## Purpose

定义 otakit 的呈现与集成行为：React 实现的 OTA 刷写界面（含浏览器能力检测）、Vue 壳桥接方式、以及注册进 weblink 聚合首页后的路由与 i18n 行为。

## ADDED Requirements

### Requirement: 浏览器能力检测

界面 SHALL 在启动时检测当前浏览器是否支持 Web Serial，并在不支持时渲染明确的引导提示（建议使用 Chrome/Edge），MUST NOT 渲染不可用的刷写入口。

#### Scenario: 不支持的浏览器

- **WHEN** 用户使用不支持 Web Serial 的浏览器打开 otakit
- **THEN** 页面显示"浏览器不支持"提示及替代建议，不显示刷写入口

#### Scenario: 非安全上下文

- **WHEN** 页面运行在非 HTTPS 且非 localhost 环境
- **THEN** 显示"需要安全上下文"提示

### Requirement: OTA 刷写流程界面

界面 SHALL 呈现完整刷写流程：串口选择 → 固件选择（URL 或本地上传）→ 连接 bootloader → 刷写进度 → 成功或失败页（含可重试的错误说明）。所有文案 SHALL 通过 i18n 键提供中英文两种语言。

#### Scenario: 完整成功流程

- **WHEN** 用户选择串口、选择固件并点击刷写
- **THEN** 界面依次呈现连接中、擦除中、写入中进度，最终呈现成功页

#### Scenario: 刷写失败后重试

- **WHEN** 刷写过程中发生错误
- **THEN** 界面呈现失败原因并保留表单，用户可修改后直接重试

### Requirement: URL 参数预填与自动开始

界面 SHALL 在启动时解析 URL 参数（`parseUrlParams`），用参数预填串口配置（slaveId/baudrate）与固件 URL；当 `auto=1` 且固件 URL 存在时，SHALL 在用户选择串口后自动开始刷写流程。`parity`/`stopbits` 不通过 URL 参数预填（固定 0/1）。

#### Scenario: URL 参数预填

- **WHEN** URL 携带 `slaveId=1&baudrate=115200&firmware=https://...`
- **THEN** 界面预填对应配置，固件 URL 显示在固件选择区

#### Scenario: 自动开始

- **WHEN** URL 携带 `auto=1` 且固件 URL 存在，用户选择串口后
- **THEN** 自动开始刷写流程，无需手动点击"开始"

### Requirement: 串口日志面板

界面 SHALL 提供刷写过程日志面板，展示连接、擦除、写入、复位各阶段的日志与进度，支持清空日志。

#### Scenario: 日志展示

- **WHEN** 刷写流程进行中
- **THEN** 日志面板实时展示各阶段日志与进度百分比

### Requirement: Vue 壳桥接

kit SHALL 导出一个 Vue 组件形态的页面入口，供 weblink 聚合应用动态加载：挂载时创建 React 根并渲染刷写界面，卸载时销毁 React 根并触发会话资源清理；重复挂载/卸载 MUST 无泄漏、无报错。

#### Scenario: Vue 应用挂载与卸载

- **WHEN** weblink 聚合应用进入 otakit 路由随后离开
- **THEN** React 界面随挂载出现、随卸载销毁，串口会话同步释放

### Requirement: 聚合首页注册与 i18n

kit SHALL 以懒加载方式注册进 weblink 聚合首页的 kit 注册表：首页可见其标题与描述，进入时才加载代码；加载时合并中英文语言包，切换语言时界面文案随之切换。

#### Scenario: 首页可见并可进入

- **WHEN** 用户打开 weblink 聚合首页
- **THEN** 能看到 otakit 卡片，点击进入后刷写界面可用

#### Scenario: 中文环境文案

- **WHEN** 聚合应用语言为 zh-CN
- **THEN** otakit 界面全部呈现中文文案
