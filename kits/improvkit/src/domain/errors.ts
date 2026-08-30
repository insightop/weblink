/**
 * domain 层错误语义：领域错误类别、SDK 错误码映射与领域错误类型。
 *
 * 本模块是 SDK 错误码唯一的落地与外泄点（design.md D2）：其余 domain /
 * infrastructure / features 代码只接触 DomainErrorCategory，不出现任何原生错误码。
 */

// ---------------------------------------------------------------------------
// SDK 错误码常量（本地同值定义）
//
// 来源：improv-wifi-serial-sdk@2.8.1 的 ImprovSerialErrorState（const enum，
// 类型声明位于 dist/const.d.ts）。实测其编译产物 dist/const.js 不导出该枚举的
// 运行时值（`import { ImprovSerialErrorState }` 得到 undefined，成员访问抛
// TypeError），且 workspace tsconfig 开启 isolatedModules，引用 ambient const
// enum 会触发 TS2748——故在此本地定义同值常量，值域与上游完全一致。
// ---------------------------------------------------------------------------

const SDK_ERROR_CODE = {
  /** 无效 RPC 包 */
  INVALID_RPC_PACKET: 0x01,
  /** 未知 RPC 命令（设备不支持扫描等场景会返回此码） */
  UNKNOWN_RPC_COMMAND: 0x02,
  /** 无法连接目标 Wi-Fi */
  UNABLE_TO_CONNECT: 0x03,
  /** 提供的主机名不被接受 */
  BAD_HOSTNAME: 0x05,
  /** RPC 超时 */
  TIMEOUT: 0xfe,
  /** 未知错误 */
  UNKNOWN_ERROR: 0xff,
} as const

/**
 * 领域错误类别：上层界面只处理这些类别。
 * 注意：STOPPED 是设备状态而非错误码，不进入本映射表，由 transport 层
 * 负责把 STOPPED 归类为 DEVICE_WIFI_DISABLED。
 * DISCONNECTED 不来自 SDK 错误码映射，触发方为 transport 层的物理连接
 * 断开事件（见 transport.ts 错误投递契约）。
 */
export type DomainErrorCategory =
  | 'NOT_IMPROV_DEVICE'
  | 'DEVICE_WIFI_DISABLED'
  | 'UNABLE_TO_CONNECT'
  | 'UNKNOWN_COMMAND'
  | 'TIMEOUT'
  | 'BAD_HOSTNAME'
  | 'INVALID_PACKET'
  | 'UNKNOWN_ERROR'
  | 'DISCONNECTED'
  // 触发方为 transport 的 requestPort 取消：用户关闭浏览器设备选择器（Chrome
  // 以 NotFoundError 形态 reject）。不是设备/协议错误，不进入 ERROR 状态
  | 'REQUEST_CANCELLED'

/**
 * SDK 错误码 → 领域错误类别 映射表（未收录的码按兜底处理）。
 * 与下方 SDK_MESSAGE_TO_CATEGORY 同源：同一批 SDK 错误码在「数值 / 消息」两个
 * 外泄形态下映射一致，改动任一表必须同步另一表（errors.spec.ts 已分别固化两表）。
 */
const SDK_ERROR_TO_CATEGORY: Readonly<Record<number, DomainErrorCategory>> = {
  [SDK_ERROR_CODE.INVALID_RPC_PACKET]: 'INVALID_PACKET',
  [SDK_ERROR_CODE.UNKNOWN_RPC_COMMAND]: 'UNKNOWN_COMMAND',
  [SDK_ERROR_CODE.UNABLE_TO_CONNECT]: 'UNABLE_TO_CONNECT',
  [SDK_ERROR_CODE.BAD_HOSTNAME]: 'BAD_HOSTNAME',
  [SDK_ERROR_CODE.TIMEOUT]: 'TIMEOUT',
  [SDK_ERROR_CODE.UNKNOWN_ERROR]: 'UNKNOWN_ERROR',
}

/**
 * 将 SDK 错误码映射为领域错误类别。
 * 注意：数值码映射当前生产路径（Web Serial）未消费——上游 RPC 失败以消息
 * 字符串外泄（见 mapSdkErrorMessage），本函数为 BLE 传输预留。
 * - NO_ERROR(0x00) 不是错误，按兜底契约映射为 'UNKNOWN_ERROR'（固化于测试）
 * - 未收录的未知错误码同样兜底为 'UNKNOWN_ERROR'
 */
export function mapSdkErrorCode(code: number): DomainErrorCategory {
  return SDK_ERROR_TO_CATEGORY[code] ?? 'UNKNOWN_ERROR'
}

// ---------------------------------------------------------------------------
// SDK reject 消息 → 领域错误类别 反查表
//
// 实测上游 ImprovSerial._setError（dist/serial.js，本仓库已核实）在 RPC 失败
// 时以 ERROR_MSGS[code] 的【字符串】reject（如 "UNABLE_TO_CONNECT"），未收录
// 的错误码以 "UNKNOWN_ERROR (N)" 兜底。即 SDK 错误码有数值与消息两种外泄形态，
// 消息形态与数值形态同源（INVALID_RPC_PACKET 是唯一名称不同于类别的项），故
// 本反查表同样只落地于 errors.ts，其余层不得出现 SDK 消息字符串。
// ---------------------------------------------------------------------------
const SDK_MESSAGE_TO_CATEGORY: Readonly<Record<string, DomainErrorCategory>> = {
  INVALID_RPC_PACKET: 'INVALID_PACKET',
  UNKNOWN_RPC_COMMAND: 'UNKNOWN_COMMAND',
  UNABLE_TO_CONNECT: 'UNABLE_TO_CONNECT',
  BAD_HOSTNAME: 'BAD_HOSTNAME',
  TIMEOUT: 'TIMEOUT',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
}

/**
 * 将 SDK 对 RPC 的 reject 消息映射为领域错误类别。
 * 上游会 reject 字符串消息（见上）；非消息形态（如端口写流抛出的 Error）或
 * 未收录消息一律兜底为 'UNKNOWN_ERROR'。
 */
export function mapSdkErrorMessage(message: string): DomainErrorCategory {
  return SDK_MESSAGE_TO_CATEGORY[message] ?? 'UNKNOWN_ERROR'
}

/** 领域错误：携带错误类别，供上层界面统一展示与重试决策 */
export class DomainProvisioningError extends Error {
  readonly category: DomainErrorCategory

  constructor(category: DomainErrorCategory, message?: string) {
    super(message ?? category)
    this.name = 'DomainProvisioningError'
    this.category = category
  }
}
