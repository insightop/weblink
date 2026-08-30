# improv-provisioning 规格（delta）

## Purpose

定义 Improv Wi-Fi 配网的领域行为契约：以传输无关的方式描述配网会话的状态机、Wi-Fi 扫描、凭据下发与错误语义，并约定 Web Serial 传输的具体行为。上层界面只依赖本契约，未来新增 BLE 传输时行为语义保持不变。

## ADDED Requirements

### Requirement: 传输无关的配网会话

系统 SHALL 提供一个传输无关的配网会话抽象，向上层暴露统一的状态机与操作集合（连接、扫描、下发凭据、关闭），上层 MUST NOT 直接依赖任何具体传输的实现类型。

统一状态机状态 SHALL 为：`IDLE`、`CONNECTING`、`READY`（可接收凭据）、`AUTHORIZATION_REQUIRED`（预留，Web Serial 不会进入）、`PROVISIONING`、`PROVISIONED`、`ERROR`。

#### Scenario: 状态机按协议事件推进

- **WHEN** 底层传输报告设备进入"已授权"状态
- **THEN** 会话状态变为 `READY`，并向订阅者发出状态变更事件

#### Scenario: 上层不接触具体传输类型

- **WHEN** 上层界面消费配网会话
- **THEN** 它只看到领域状态与领域数据结构（SSID 列表、设备信息、结果），不出现 Web Serial 或 Web Bluetooth 的原生对象

### Requirement: Web Serial 设备连接

系统 SHALL 通过浏览器 Web Serial API 让用户选择串口设备，并以 115200 波特率打开端口、建立 Improv 会话。连接过程中 SHALL 能识别"所选设备不是 Improv 设备"并以领域错误上报。

#### Scenario: 用户选择 Improv 设备并连接成功

- **WHEN** 用户在浏览器设备选择器中选中一台运行 Improv 固件的设备并授权
- **THEN** 会话完成初始化，状态到达 `READY`，且可读取设备信息（名称、固件、版本、芯片家族）

#### Scenario: 所选设备不支持 Improv

- **WHEN** 用户选择的设备在初始化超时内未响应 Improv 协议
- **THEN** 会话进入 `ERROR`，错误类别为"非 Improv 设备"，且底层端口资源被释放

#### Scenario: 用户取消设备选择

- **WHEN** 用户在浏览器串口选择器中取消选择
- **THEN** 会话以"请求取消"类别结束且界面状态不受污染，可直接再次发起连接

### Requirement: 设备信息读取

会话建立后，系统 SHALL 能返回设备的名称、固件名、固件版本、芯片家族等设备信息；字段缺失时 MUST 以空值表达而非抛错。

#### Scenario: 读取设备信息

- **WHEN** 会话处于 `READY` 且设备支持信息查询
- **THEN** 返回包含 name/firmware/version/chipFamily 的设备信息对象

### Requirement: Wi-Fi 扫描与降级

系统 SHALL 支持向设备发起 Wi-Fi 扫描并返回按名称排序的 SSID 列表（含信号强度与加密标志）；当设备不支持扫描命令时，系统 MUST 优雅降级为手动输入 SSID 模式，而非失败。

#### Scenario: 设备支持扫描

- **WHEN** 会话处于 `READY` 且设备具备扫描能力
- **THEN** 返回 SSID 列表，同名网络以最新一次扫描结果为准

#### Scenario: 设备不支持扫描

- **WHEN** 设备对扫描命令返回"未知命令"错误
- **THEN** 扫描结果标记为不可用，会话保持 `READY`，允许用户直接手动输入 SSID

### Requirement: 下发 Wi-Fi 凭据

系统 SHALL 将 SSID 与密码下发给设备并等待配网结果：成功时状态进入 `PROVISIONED` 并返回设备提供的跳转 URL（可能为空）；失败时状态进入 `ERROR` 并携带设备错误类别（无法连接 / 超时 / 无效包等）。

#### Scenario: 配网成功

- **WHEN** 设备成功接入指定 Wi-Fi
- **THEN** 会话状态变为 `PROVISIONED`，结果中包含设备返回的 URL（若设备提供）

#### Scenario: 设备无法连接目标网络

- **WHEN** 设备报告"无法连接"错误
- **THEN** 会话状态变为 `ERROR`，错误类别为"无法连接"，用户可修改凭据后重试

### Requirement: 错误语义映射

系统 SHALL 将底层 SDK/协议的错误码与异常设备状态映射为有限的领域错误类别（非 Improv 设备、设备 Wi-Fi 已关闭、无法连接、未知命令、超时、无效主机名、无效包、未知错误、连接中断），上层界面只需处理这些类别。

#### Scenario: 底层超时映射

- **WHEN** 底层 RPC 在超时窗口内未收到响应
- **THEN** 领域错误类别为"超时"

#### Scenario: 设备 Wi-Fi 关闭映射

- **WHEN** 会话初始化后设备报告配网服务停止（如设备 Wi-Fi 已关闭）
- **THEN** 会话状态变为 `ERROR`，错误类别为"设备 Wi-Fi 已关闭"

#### Scenario: 物理连接中断

- **WHEN** 会话进行中串口连接意外断开
- **THEN** 会话状态变为 `ERROR`，错误类别为"连接中断"，界面可据此提示重新连接

### Requirement: 会话资源清理

系统 SHALL 提供关闭会话的能力：关闭后停止扫描轮询、释放串口读取器与端口锁；重复关闭 MUST 幂等。

#### Scenario: 关闭会话释放端口

- **WHEN** 用户关闭配网会话或组件卸载
- **THEN** 串口端口被释放，后续再次连接同一设备不受影响

#### Scenario: 重复关闭幂等

- **WHEN** 对已关闭的会话再次调用关闭
- **THEN** 不抛错、无副作用
