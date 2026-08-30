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
