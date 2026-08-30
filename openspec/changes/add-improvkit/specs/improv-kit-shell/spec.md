# improv-kit-shell 规格（delta）

## Purpose

定义 improvKit 的呈现与集成行为：React 实现的配网流程界面（含浏览器能力检测）、Vue 壳桥接方式、以及注册进 weblink 聚合首页后的路由与 i18n 行为。

## ADDED Requirements

### Requirement: 浏览器能力检测

界面 SHALL 在启动时检测当前浏览器是否支持 Web Serial，并在不支持时渲染明确的引导提示（建议使用 Chrome/Edge），MUST NOT 渲染不可用的配网入口。

#### Scenario: 不支持的浏览器

- **WHEN** 用户使用不支持 Web Serial 的浏览器打开 improvKit
- **THEN** 页面显示"浏览器不支持"提示及替代建议，不显示连接入口

#### Scenario: 非安全上下文

- **WHEN** 页面运行在非 HTTPS 且非 localhost 环境
- **THEN** 显示"需要安全上下文"提示

### Requirement: 配网流程界面

界面 SHALL 呈现完整配网流程：连接入口 → 连接中反馈 → 设备信息展示 → 网络选择（扫描列表或手动输入）→ 密码输入 → 配网进度 → 成功页（含设备返回 URL 的跳转入口）或失败页（含可重试的错误说明）。所有文案 SHALL 通过 i18n 键提供中英文两种语言。

#### Scenario: 完整成功流程

- **WHEN** 用户连接 Improv 设备、选择网络、输入正确密码并提交
- **THEN** 界面依次呈现连接中、配网中进度，最终呈现成功页与"访问设备"入口（当设备返回 URL 时）

#### Scenario: 密码错误导致失败后重试

- **WHEN** 设备报告无法连接目标网络
- **THEN** 界面呈现失败原因并保留表单，用户修改密码后可直接重试

### Requirement: 已配网设备的换网

对已处于 `PROVISIONED` 状态的设备，界面 SHALL 提供"更换 Wi-Fi"入口，重新进入网络选择与凭据表单。

#### Scenario: 更换 Wi-Fi

- **WHEN** 设备已配网且用户点击"更换 Wi-Fi"
- **THEN** 界面重新呈现网络选择与凭据表单，提交后走正常配网流程

### Requirement: Vue 壳桥接

kit SHALL 导出一个 Vue 组件形态的页面入口，供 weblink 聚合应用动态加载：挂载时创建 React 根并渲染配网界面，卸载时销毁 React 根并触发会话资源清理；重复挂载/卸载 MUST 无泄漏、无报错。

#### Scenario: Vue 应用挂载与卸载

- **WHEN** weblink 聚合应用进入 improvKit 路由随后离开
- **THEN** React 界面随挂载出现、随卸载销毁，串口会话同步释放

### Requirement: 聚合首页注册与 i18n

kit SHALL 以懒加载方式注册进 weblink 聚合首页的 kit 注册表：首页可见其标题与描述，进入时才加载代码；加载时合并中英文语言包，切换语言时界面文案随之切换。

#### Scenario: 首页可见并可进入

- **WHEN** 用户打开 weblink 聚合首页
- **THEN** 能看到 improvKit 卡片，点击进入后配网界面可用

#### Scenario: 中文环境文案

- **WHEN** 聚合应用语言为 zh-CN
- **THEN** improvKit 界面全部呈现中文文案
