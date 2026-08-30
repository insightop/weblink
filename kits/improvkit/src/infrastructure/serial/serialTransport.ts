/**
 * Web Serial 传输实现（infrastructure 层）：包装上游 ImprovSerial 会话，
 * 实现 domain 层 IImprovTransport 接口，把 SDK 事件/错误翻译为领域状态与
 * 错误类别。SDK 错误码与消息字符串只在 domain/errors.ts 落地，本层不出现
 * 原生错误码（design.md D2：其余代码只接触 DomainErrorCategory）。
 *
 * ## SDK 错误提取结论（已核实 dist/serial.js `_setError`）
 * 上游在 RPC 失败时以 ERROR_MSGS[code] 的【字符串】reject（如
 * "UNABLE_TO_CONNECT"），未收录码以 "UNKNOWN_ERROR (N)" 兜底——既非数字也
 * 非 Error 实例。本层据此按消息反查（errors.mapSdkErrorMessage）；非字符串
 * reject（如端口写流抛出的 Error）按兜底归为 UNKNOWN_ERROR。
 */
import { ImprovSerialCurrentState } from 'improv-wifi-serial-sdk/dist/const.js'
import { ImprovSerial } from 'improv-wifi-serial-sdk/dist/serial.js'
import type { DomainErrorCategory } from '../../domain/errors'
import { DomainProvisioningError, mapSdkErrorMessage } from '../../domain/errors'
import type { DeviceInfo, ImprovState, ProvisionResult, Ssid } from '../../domain/types'
import type { ErrorListener, IImprovTransport, StateListener } from '../../domain/transport'

/** Improv Wi-Fi Serial 协议约定波特率（上游 SDK 文档/示例固定值） */
const DEFAULT_BAUD_RATE = 115200

/** 会话信息（initialize 的 resolve 形态，字段与领域 DeviceInfo 一一对应） */
export interface SessionInfoLike {
  firmware: string
  version: string
  name: string
  chipFamily: string
  osName: string | null
  osVersion: string | null
}

/**
 * 传输会话的最小抽象：真实 ImprovSerial 拥有的、本 transport 用到的成员。
 * 单测注入 EventTarget 假会话即可驱动全部行为。
 */
export interface ImprovSessionLike extends EventTarget {
  info?: SessionInfoLike
  state?: number
  nextUrl?: string
  initialize(timeout?: number): Promise<SessionInfoLike>
  close(): Promise<void>
  provision(ssid: string, password: string, timeout?: number): Promise<void>
  scan(timeout?: number): Promise<Ssid[]>
}

/** 传输依赖：端口获取/打开与会话创建均可注入（单测/集成测试替换点） */
export interface SerialTransportDeps {
  requestPort(): Promise<SerialPort>
  openPort(port: SerialPort, baudRate: number): Promise<void>
  createSession(port: SerialPort): ImprovSessionLike
}

/** 浏览器默认依赖：Web Serial 选择器 + 真实 ImprovSerial 会话 */
export function createDefaultSerialDeps(): SerialTransportDeps {
  return {
    requestPort: () => navigator.serial.requestPort(),
    // 参考 esphome/esp-web-tools 官方实践：打开串口时显式指定 bufferSize 以
    // 提升高吞吐（扫描/配网 RPC 往返）下的读取稳定性，避免默认缓冲过小丢包
    openPort: (port, baudRate) => port.open({ baudRate, bufferSize: 8192 }),
    // 上游 SDK initialize 的返回类型为 Promise<info|undefined>（info 属性可
    // 选），而本层接口约定 resolve 必有值——实际 initialize 成功时必已赋值
    // info 对象，此处用断言收口类型差异
    createSession: (port) => new ImprovSerial(port, console) as unknown as ImprovSessionLike,
  }
}

/**
 * SDK CURRENT_STATE 数值 → 领域状态映射。
 * STOPPED(0x00) 单独处理（需附带 onError 副作用），不进入本表；
 * AUTHORIZATION_REQUIRED 为 BLE 传输预留，Web Serial 无授权流程，不存在
 * 对应来源（见 domain/types.ts 注释）。
 */
const SDK_STATE_TO_IMPROV: Readonly<Partial<Record<number, ImprovState>>> = {
  [ImprovSerialCurrentState.READY]: 'READY',
  [ImprovSerialCurrentState.PROVISIONING]: 'PROVISIONING',
  [ImprovSerialCurrentState.PROVISIONED]: 'PROVISIONED',
}

/** 从 SDK reject 值提取领域错误类别：字符串消息反查，其余一律兜底 */
function messageCategoryOf(cause: unknown): DomainErrorCategory {
  return mapSdkErrorMessage(typeof cause === 'string' ? cause : '')
}

/** 会话信息 → 领域设备信息：缺失字段以空串/ null 表达，不抛错（types.ts 契约） */
function mapSessionInfo(info: SessionInfoLike): DeviceInfo {
  return {
    name: info.name ?? '',
    firmware: info.firmware ?? '',
    version: info.version ?? '',
    chipFamily: info.chipFamily ?? '',
    osName: info.osName ?? null,
    osVersion: info.osVersion ?? null,
  }
}

function describeCause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

export class SerialTransport implements IImprovTransport {
  private readonly deps: SerialTransportDeps
  private _state: ImprovState = 'IDLE'
  private session: ImprovSessionLike | null = null
  /** 当前会话是否已由 close()/connect 失败清理关闭（disconnect 忽略判断与 close 幂等共用） */
  private sessionClosed = false
  /** 物理端口引用：requestPort 成功后持有，close / connect 失败 / 断连时尽力关闭并置空（F3） */
  private portRef: SerialPort | null = null
  private unsubscribeSession: (() => void) | null = null
  /**
   * 代际 token：每次 connect 自增；异步清理/提交路径执行前校验代际是否仍匹配，
   * 防止旧一代的清理毁掉新一代的订阅 / session（connect 防重入的异步侧兜底）
   */
  private generation = 0
  /** 是否已因物理断连上报过 DISCONNECTED：挂起 RPC 的失败据此合并为单次上报（F4） */
  private disconnectedReported = false
  private readonly stateListeners = new Set<StateListener>()
  private readonly errorListeners = new Set<ErrorListener>()

  /** 缺省合并：未注入的依赖回退到浏览器默认实现 */
  constructor(deps?: Partial<SerialTransportDeps>) {
    this.deps = { ...createDefaultSerialDeps(), ...deps }
  }

  get state(): ImprovState {
    return this._state
  }

  onStateChange(listener: StateListener): () => void {
    this.stateListeners.add(listener)
    return () => this.stateListeners.delete(listener)
  }

  onError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener)
    return () => this.errorListeners.delete(listener)
  }

  async connect(): Promise<DeviceInfo> {
    // 陈旧会话自愈（断连后直接重连）：物理断连时 session 被有意保留——它是 F4
    // 双报合并（挂起 RPC 归并为单次 DISCONNECTED）的承重墙——但入口守卫
    // （CONNECTING || session）会因此把「断连后的直接重连」永久挡下并误报
    // 'connect already in progress'。若在册会话已非活跃（已关闭，或已上报过
    // 断连且处于 ERROR），先同步退订监听、尽力关闭会话与端口、清空引用，让
    // 重连正常走流程；活跃会话（未断连未关闭）期间的重入仍被守卫拒绝。
    const stale = this.session
    if (stale && (this.sessionClosed || (this.disconnectedReported && this.state === 'ERROR'))) {
      // 先退订再关会话：旧会话 close() 派发的 disconnect 不得被当作新连接的
      // 物理断连误报（与 close() 的退订顺序同理）
      const unsubscribe = this.unsubscribeSession
      this.unsubscribeSession = null
      unsubscribe?.()
      // 尽力关闭并吞错：断连后 SDK 读取流已终结，close 应幂等无副作用；清理
      // 失败不阻塞重连
      await stale.close().catch(() => {})
      // 清空引用与陈旧标记：入口守卫据此放行本次重连；物理断连时 portRef 已
      // 由 onDisconnect 置空，此处兜底其余非活跃形态
      this.session = null
      this.sessionClosed = false
      this.disconnectedReported = false
      if (this.portRef) {
        this.portRef.close?.().catch(() => {})
        this.portRef = null
      }
    }
    // 防重入：CONNECTING 中或已有活跃会话时直接拒绝，避免并发 connect 互相踩踏
    // 订阅与状态（上层 UI 串行调用，此处是最后一道防线；await 窗口期的竞态由
    // 下方代际校验兜底）
    if (this.state === 'CONNECTING' || this.session) {
      throw new DomainProvisioningError('UNKNOWN_ERROR', 'connect already in progress')
    }
    // 记录当前代：本次 connect 所建会话/订阅/端口均归属此代，异步路径据此识别
    // 归属——清理与 await 后的提交点都做代际校验，防止旧一代毁掉新一代的资源
    const generation = ++this.generation
    // 选择并打开端口：requestPort 弹出浏览器串口授权选择器
    let port: SerialPort
    try {
      port = await this.deps.requestPort()
    } catch (cause) {
      // 用户取消设备选择：Chrome 以 NotFoundError 形态 reject requestPort（Web
      // Serial 规范：用户关闭选择器即 reject NotFoundError）。归为请求取消类别且
      // 不改变状态（保持 IDLE）——界面可直接再次发起连接。设备选择器之外的宿主
      // 异常按原样外泄不加映射：属环境故障，交由上层兜底
      if (cause instanceof DOMException && cause.name === 'NotFoundError') {
        throw new DomainProvisioningError('REQUEST_CANCELLED')
      }
      throw cause
    }
    // 代际校验：等待选择器期间（状态仍 IDLE、无会话）入口守卫存在理论窗口——
    // 期间若已有新的 connect 接管，让出刚取到的端口并按重入语义拒绝
    if (generation !== this.generation) {
      port.close?.().catch(() => {})
      throw new DomainProvisioningError('UNKNOWN_ERROR', 'connect already in progress')
    }
    this.portRef = port
    try {
      await this.deps.openPort(port, DEFAULT_BAUD_RATE)
    } catch (cause) {
      // 打开失败属宿主环境故障：按原样外泄（不加映射），但已取到的端口尽力释放
      port.close?.().catch(() => {})
      // 引用守卫：openPort 等待窗口内可能已有新一代 connect 接管并持有自己的
      // portRef，此处只能清本代的引用，否则会把新一代的端口引用一并清掉，
      // 导致其 close() 跳过物理端口关闭（泄漏）
      if (this.portRef === port) {
        this.portRef = null
      }
      throw cause
    }
    // 第二个 await 边界（openPort 期间）同样代际兜底，之后进入同步提交区：
    // createSession → 赋值 → 订阅 → CONNECTING 一步到位、无 await，不会再有
    // 并发 connect 插入
    if (generation !== this.generation) {
      port.close?.().catch(() => {})
      // 引用守卫（与 openPort 失败清理同构）：过期代只清自己的引用，不得清掉
      // 新一代已持有的 portRef（否则其 close() 会跳过物理端口关闭 → 泄漏）
      if (this.portRef === port) {
        this.portRef = null
      }
      throw new DomainProvisioningError('UNKNOWN_ERROR', 'connect already in progress')
    }
    const session = this.deps.createSession(port)
    this.session = session
    this.sessionClosed = false
    this.disconnectedReported = false
    // 先订阅再初始化：initialize 的第一个 RPC（REQUEST_CURRENT_STATE）会立即
    // 得到初始状态应答，订阅在先才能观察到设备开机态（如 STOPPED）
    this.unsubscribeSession = this.attachSessionHandlers(session)
    this.setState('CONNECTING')
    try {
      // 参考 esp-web-tools 实践：initialize 用 5 秒超时而非 SDK 默认 1000ms。
      // 刚烧录/重启中的设备首个 RPC（REQUEST_CURRENT_STATE）应答可能较慢，
      // 默认 1s 偏紧易误报 NOT_IMPROV_DEVICE；放宽到 5s 降低真机误报。
      const info = await session.initialize(5000)
      const deviceInfo = mapSessionInfo(info)
      this.setState('READY')
      return deviceInfo
    } catch (cause) {
      await this.handleConnectFailure(session, port, generation)
      throw new DomainProvisioningError('NOT_IMPROV_DEVICE', describeCause(cause))
    }
  }

  async scan(): Promise<Ssid[] | null> {
    if (!this.session || this.sessionClosed) {
      throw new DomainProvisioningError('UNKNOWN_ERROR', 'scan requires an active session')
    }
    try {
      return await this.session.scan()
    } catch (cause) {
      // 断连合并（F4）：会话已因物理断连上报过 DISCONNECTED 时，本操作失败是
      // 断连的连带结果——直接以 DISCONNECTED reject，不重复 setState / onError，
      // UI 只收到一次断连事实，消除二次 TIMEOUT 报错（transport.ts 契约）
      if (this.disconnectedReported) {
        throw new DomainProvisioningError('DISCONNECTED')
      }
      const category = messageCategoryOf(cause)
      // UNKNOWN_COMMAND 表示设备不支持扫描：按接口契约降级为 null（上层回退到
      // 手动输入 SSID），不是错误，不进入 ERROR 状态、不走 onError
      if (category === 'UNKNOWN_COMMAND') return null
      this.setState('ERROR')
      throw new DomainProvisioningError(category)
    }
  }

  async provision(ssid: string, password: string): Promise<ProvisionResult> {
    if (!this.session || this.sessionClosed) {
      throw new DomainProvisioningError('UNKNOWN_ERROR', 'provision requires an active session')
    }
    try {
      await this.session.provision(ssid, password)
      // SDK provision 把跳转 URL 存在 session.nextUrl（方法本身不返回值）；
      // 空串表示设备没有给出 URL，归一为 undefined
      return { nextUrl: this.session.nextUrl || undefined }
    } catch (cause) {
      // 断连合并（F4，与 scan 相同）：物理断连已上报时，挂起 RPC 的失败归并为
      // DISCONNECTED 单次上报，不重复 setState / 二次错误
      if (this.disconnectedReported) {
        throw new DomainProvisioningError('DISCONNECTED')
      }
      this.setState('ERROR')
      throw new DomainProvisioningError(messageCategoryOf(cause))
    }
  }

  async close(): Promise<void> {
    const session = this.session
    if (!session || this.sessionClosed) return // 未连接或已关闭：幂等，无副作用
    this.sessionClosed = true
    // 先退订再关会话：session.close() 会 cancel 读取流并派发 disconnect，若还
    // 挂着监听会被误报为物理断开（DISCONNECTED）——正常关闭不是断开故障
    const unsubscribe = this.unsubscribeSession
    this.unsubscribeSession = null
    unsubscribe?.()
    // SDK 当前经 disconnect resolve、不会 reject，.catch 为未来兼容防御（与
    // handleConnectFailure 的同语句一致，吞错不影响 close 的成功语义）
    await session.close().catch(() => {})
    // 条件式清引用：只清本次 close 持有的会话，避免与并发 connect 的新一代会话
    // 互相踩踏（防重入的引用级兜底，语义见 connect 代际说明）。session 与
    // portRef 同在 connect 赋值、同在清理置空，代际不匹配时自然跳过端口关闭
    if (this.session === session) {
      this.session = null
      // 上游 ImprovSerial.close() 只 cancel 读取流、不关闭物理端口（serial.js
      // 已核实）；端口释放必须由 transport 层补齐，否则端口保持占用直到页面
      // 卸载。尽力关闭并吞错：关闭失败不影响 close 的成功语义
      if (this.portRef) {
        this.portRef.close?.().catch(() => {})
        this.portRef = null
      }
    }
  }

  /**
   * connect 失败后的清理：摘监听 → 置 ERROR → 尽力关闭会话与端口。
   * 代际 + 引用双重守卫：await 间隙若已发起新一轮 connect（或已 close），
   * 旧一代的清理不得触碰新一代的订阅 / session / 端口（防重入的异步侧兜底）。
   */
  private async handleConnectFailure(
    session: ImprovSessionLike,
    port: SerialPort,
    generation: number,
  ): Promise<void> {
    // 代际校验：本次 connect 已不是最新一代（新 connect 已接管），直接放弃清理
    if (generation !== this.generation) return
    // 先摘监听：initialize 失败时 SDK 已内部 close()（会派发 disconnect），
    // 该断开属于本次 connect 失败的一部分，由 connect() 的 reject 统一上报，
    // 不误报为物理连接的 DISCONNECTED
    const unsubscribe = this.unsubscribeSession
    if (unsubscribe && this.session === session) {
      this.unsubscribeSession = null
      unsubscribe()
    }
    this.setState('ERROR')
    // 尽力清理：清理失败不影响主错误上报（fake 端口可能没有 close 方法）
    await session.close().catch(() => {})
    // 僵尸会话防护（F2）：失败后必须清掉会话引用并置 closed 标记，保证后续
    // scan / provision 走「无活跃会话」守卫，而不是对死会话发 RPC
    if (this.session === session) {
      this.session = null
      this.sessionClosed = true
      // 上游 ImprovSerial.close() 不关物理端口（serial.js 已核实），端口释放由
      // transport 层补齐：尽力关闭并吞错，且只在端口仍属本会话时执行
      if (this.portRef === port) {
        port.close?.().catch(() => {})
        this.portRef = null
      }
    }
  }

  /** 订阅会话三事件，返回一次性取消订阅函数 */
  private attachSessionHandlers(session: ImprovSessionLike): () => void {
    const onStateChanged = (event: Event): void => {
      // SDK 用 CustomEvent 派发 state-changed，detail 为 CURRENT_STATE 数值
      this.handleSdkState((event as CustomEvent<number>).detail)
    }
    const onErrorChanged = (_event: Event): void => {
      // 刻意不转发：操作失败（scan/provision）走各自 promise reject 上报，
      // error-changed 再转 onError 会造成双通道重复上报同一错误；未来若需
      // "设备主动报告错误码"这类非操作通道，再在此扩展
    }
    const onDisconnect = (): void => {
      // CONNECTING 期间的断开属于该次 connect 操作失败的一部分，由 connect()
      // 的 reject 统一上报，不走 onError（错误投递契约：操作绑定失败只 reject）；
      // 已关闭或从未建立的会话忽略（close() 先摘监听再关会话，这里再兜底一层）
      if (this.state === 'CONNECTING') return
      if (!this.session || this.sessionClosed) return
      // 端口已物理终结：transport 不再持有（SDK 读取循环已结束）
      this.portRef = null
      // 记录断连已上报（F4）：此后挂起 RPC 的失败合并为 DISCONNECTED 单次上报，
      // 不再重复 setState / onError
      this.disconnectedReported = true
      this.setState('ERROR')
      this.emitError('DISCONNECTED')
    }
    session.addEventListener('state-changed', onStateChanged)
    session.addEventListener('error-changed', onErrorChanged)
    session.addEventListener('disconnect', onDisconnect)
    return () => {
      session.removeEventListener('state-changed', onStateChanged)
      session.removeEventListener('error-changed', onErrorChanged)
      session.removeEventListener('disconnect', onDisconnect)
    }
  }

  private handleSdkState(code: number): void {
    if (code === ImprovSerialCurrentState.STOPPED) {
      // STOPPED = 设备 Wi-Fi 被禁用：进入 ERROR 并上报领域类别（errors.ts 注释：
      // STOPPED 是设备状态而非错误码，由 transport 归为 DEVICE_WIFI_DISABLED）
      this.setState('ERROR')
      this.emitError('DEVICE_WIFI_DISABLED')
      return
    }
    const mapped = SDK_STATE_TO_IMPROV[code]
    if (mapped) this.setState(mapped)
    // 未收录的状态码忽略：协议未定义的值不臆造语义
  }

  private setState(next: ImprovState): void {
    this._state = next
    for (const listener of this.stateListeners) listener(next)
  }

  private emitError(category: DomainErrorCategory): void {
    for (const listener of this.errorListeners) listener(category)
  }
}
