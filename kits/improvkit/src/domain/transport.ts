import type { DomainErrorCategory } from './errors'
import type { DeviceInfo, ImprovState, ProvisionResult, Ssid } from './types'

/** 状态变更监听器 */
export type StateListener = (state: ImprovState) => void

/** 错误监听器：回调领域错误类别（见 errors.ts） */
export type ErrorListener = (category: DomainErrorCategory) => void

/**
 * 传输无关的 Improv 配网会话抽象——domain 层唯一对外操作接口
 * （Clean 分层：上层界面只依赖本接口，spec「上层不接触具体传输类型」）。
 * 具体传输（Web Serial / 未来 BLE）在 infrastructure 层实现本接口。
 *
 * ## 错误投递契约（Promise reject 与 onError 双通道分工）
 * - 已建立会话后的操作失败（connect 初始化 / scan / provision）：以
 *   `DomainProvisioningError` reject，且 reject 前 state 必须转换为 'ERROR'
 *   （未建立会话时调用操作由「未连接守卫」直接 reject、不改变状态，与本条分工
 *   一致；connect 期间用户取消设备选择同样不改状态，见 REQUEST_CANCELLED）；
 * - `onError` 监听器仅用于**非操作绑定**的异步传输错误（如物理连接中断），
 *   与 Promise reject 不双通道重复上报同一错误；
 * - 物理连接中断语义：state → 'ERROR'，错误类别为 'DISCONNECTED'；
 *   物理断连期间挂起的操作将以 DISCONNECTED 统一 reject，不再产生二次错误上报。
 *
 * ## 订阅与读取
 * - 订阅不重放当前值：消费方应先订阅、再读 `state`，避免丢事件竞态。
 */
export interface IImprovTransport {
  /** 当前会话状态（只读，外部禁止直接赋值，只能经订阅事件观察变化） */
  readonly state: ImprovState

  /** 订阅状态变更；返回取消订阅函数。不重放当前值，应先订阅再读 state */
  onStateChange(listener: StateListener): () => void

  /**
   * 订阅错误事件；返回取消订阅函数。
   * 仅接收非操作绑定的异步传输错误（如物理连接中断），不会与
   * 方法级 Promise reject 重复上报同一错误。
   */
  onError(listener: ErrorListener): () => void

  /** 完成设备选择、打开与初始化；resolve 时已进入 READY 并携带设备信息。已建立会话后的失败以 DomainProvisioningError reject 且 state 转为 'ERROR'；用户取消设备选择（REQUEST_CANCELLED）则保持 IDLE */
  connect(): Promise<DeviceInfo>

  /** 扫描 Wi-Fi 网络；返回 null 表示设备不支持扫描（降级为手动输入 SSID），不是错误。失败以 DomainProvisioningError reject 且 state 转为 'ERROR' */
  scan(): Promise<Ssid[] | null>

  /** 下发 Wi-Fi 凭据并等待配网结果。失败以 DomainProvisioningError reject 且 state 转为 'ERROR' */
  provision(ssid: string, password: string): Promise<ProvisionResult>

  /** 关闭会话并释放底层资源（停止轮询、释放端口）；重复调用必须幂等 */
  close(): Promise<void>
}
