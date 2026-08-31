/**
 * domain 层数据契约：传输无关的领域类型定义。
 * 本模块不依赖任何 SDK / 框架类型，供 domain / infrastructure / features 各层共用。
 */

/** 设备返回的单个 Wi-Fi 网络（扫描结果项） */
export interface Ssid {
  name: string
  rssi: number
  secured: boolean
}

/**
 * 设备能力信息。
 * 设备不支持查询或字段缺失时以 null / 空字符串表达，不抛错（spec「设备信息读取」）。
 */
export interface DeviceInfo {
  name: string
  firmware: string
  version: string
  chipFamily: string
  osName: string | null
  osVersion: string | null
}

/** 配网结果：设备返回的可选跳转 URL（可能为空） */
export interface ProvisionResult {
  nextUrl?: string
}

/**
 * 控制台模式的串口端口抽象：仅暴露日志读取所需的读写流。
 * 用结构类型（而非 w3c SerialPort 具体类型）保持 clean 边界——domain 层
 * 不依赖具体传输类型，具体 SerialPort 由 infrastructure 层在实现时适配。
 * readable / writable 可为 null：端口未打开或流不可用时表达「不可用」，
 * 由调用方（Logs/Console 模式）自行判空，不抛错。
 */
export interface ConsolePort {
  readonly readable: ReadableStream<Uint8Array> | null
  readonly writable: WritableStream<Uint8Array> | null
}

/**
 * 统一配网会话状态（传输无关，spec「传输无关的配网会话」）。
 * AUTHORIZATION_REQUIRED 为 BLE 传输预留：Web Serial 协议没有授权流程，
 * 不会产生该状态；未来 BLE 传输需设备授权时由对应实现驱动进入此状态。
 */
export type ImprovState =
  | 'IDLE'
  | 'CONNECTING'
  | 'READY'
  | 'AUTHORIZATION_REQUIRED'
  | 'PROVISIONING'
  | 'PROVISIONED'
  | 'ERROR'
