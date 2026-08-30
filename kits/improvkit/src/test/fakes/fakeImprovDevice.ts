import { ImprovSerialMessageType, SERIAL_PACKET_HEADER } from 'improv-wifi-serial-sdk/dist/const.js'
import type { Ssid } from '../../domain/types'

/**
 * Improv Serial 线协议帧编解码 + 脚本化假设备端口（测试基础设施）。
 *
 * 帧布局（与真实 SDK dist/serial.js 完全一致，勿改动）：
 *   [0..5]="IMPROV" [6]=版本1 [7]=类型 [8]=数据长度N [data(N)] [校验和] [0x0A]
 *   校验和 = 除自身外全部字节之和 & 0xFF
 * 本模块被集成测试直接注入真实 ImprovSerial（`as unknown as SerialPort`），
 * 因此应答细节必须逐字节对齐客户端解析逻辑（见各 respond* 注释）。
 */

/** 除最后一字节外的换行分隔符（帧/噪声段边界） */
const NEW_LINE = 0x0a

// ---------------------------------------------------------------------------
// 被上游擦除的 const enum 同值常量
// 来源：improv-wifi-serial-sdk@2.8.1 dist/const.d.ts（同上游 const.js 中
// ImprovSerialCurrentState / ImprovSerialErrorState 的值域一致）
// ---------------------------------------------------------------------------

const RPC_COMMAND = {
  SEND_WIFI_SETTINGS: 1,
  REQUEST_CURRENT_STATE: 2,
  REQUEST_INFO: 3,
  REQUEST_WIFI_NETWORKS: 4,
} as const

const CURRENT_STATE_CODE = {
  STOPPED: 0x00,
  READY: 0x02,
  PROVISIONING: 0x03,
  PROVISIONED: 0x04,
} as const

const ERROR_STATE_CODE = {
  UNKNOWN_RPC_COMMAND: 0x02,
  UNABLE_TO_CONNECT: 0x03,
} as const

/** cmd=3 应答的内置默认设备信息（缺省字段时使用） */
const DEFAULT_INFO = {
  firmware: 'improv-test-firmware',
  version: '1.0.0',
  chipFamily: 'ESP32',
  name: 'improv-test-device',
  osName: null,
  osVersion: null,
} as const

/** 解析出的完整帧（data 为帧负载字节，不含头部/校验和/换行） */
export interface DecodedFrame {
  type: number
  data: number[]
}

/** 假设备脚本：决定 FakeImprovPort 对各种命令的应答 */
export interface FakeImprovPortScript {
  /** 设备当前状态（cmd=2 应答），默认 READY=0x02 */
  initialState?: number
  /** cmd=3 应答的设备信息；缺省字段用内置默认值，osName/osVersion 为 null 时不追加 */
  info?: {
    firmware?: string
    version?: string
    chipFamily?: string
    name?: string
    osName?: string | null
    osVersion?: string | null
  }
  /** cmd=4 扫描结果（仅 scanSupported 为 true 时使用） */
  networks?: Ssid[]
  /** 是否支持扫描；false 时 cmd=4 应答 ERROR_STATE(UNKNOWN_RPC_COMMAND=0x02) */
  scanSupported?: boolean
  /** cmd=1 配网结果；缺省按成功处理且无跳转 URL */
  provisionOutcome?: { kind: 'ok'; nextUrl?: string } | { kind: 'fail' }
  /** 静默模式：收到任何请求都不应答（模拟非 Improv 设备） */
  silent?: boolean
}

/**
 * 把字符串编码为协议的长度前缀记录：[,len(1字节), ...UTF-8字节]。
 * 单值不得超过 255 字节（长度只占 1 字节）；配网/信息场景不会触及该上限。
 */
function encodePrefixed(value: string): number[] {
  const bytes = [...new TextEncoder().encode(value)]
  return [bytes.length, ...bytes]
}

/** 按线格式组帧：IMPROV头 + 类型 + 长度 + 数据 + 校验和 + 换行 */
export function encodeFrame(type: number, data: number[]): Uint8Array {
  const frame = [...SERIAL_PACKET_HEADER, type, data.length, ...data, 0, NEW_LINE]
  // 校验和放在倒数第 2 字节：除自身外全部字节之和 & 0xFF
  frame[frame.length - 2] = frame.slice(0, -2).reduce((sum, byte) => sum + byte, 0) & 0xff
  return Uint8Array.from(frame)
}

function isImprovHeader(candidate: number[]): boolean {
  return candidate.slice(0, 6).every((byte, i) => byte === SERIAL_PACKET_HEADER[i])
}

function checksumValid(candidate: number[]): boolean {
  const checksum = candidate.slice(0, -1).reduce((sum, byte) => sum + byte, 0) & 0xff
  return checksum === candidate[candidate.length - 1]
}

function parseFrame(candidate: number[]): DecodedFrame {
  const dataLength = candidate[8]
  return { type: candidate[7], data: candidate.slice(9, 9 + dataLength) }
}

/**
 * 批量解析字节流中的完整帧（纯函数）。
 *
 * 逐字节状态机，镜像真实 SDK 读取循环（dist/serial.js _processInput）的行为：
 * - 头部未成形时遇 0x0A 重置；凑满 9 字节才判定前 6 字节是否 "IMPROV"
 * - 非 IMPROV 前缀按噪声丢弃，直到 0x0A 重新找帧头
 * - 帧体内按长度驱动（总长=10+N），0x0A 可作为数据字节合法存在于帧内
 * - 校验和不符的帧直接丢弃
 * 未成帧的尾部（不足 10+N 或未收齐）不会输出，供调用方留待后续字节补齐。
 */
export function decodeFrames(bytes: Uint8Array | number[]): DecodedFrame[] {
  const frames: DecodedFrame[] = []
  let candidate: number[] = []
  let expectedLength = 0
  let mode: 'header' | 'frame' | 'noise' = 'header'

  for (const byte of bytes) {
    if (mode === 'noise') {
      // 噪声字节全部丢弃，直到换行重新开始找帧头
      if (byte === NEW_LINE) mode = 'header'
      continue
    }
    if (mode === 'header') {
      if (byte === NEW_LINE) {
        candidate = []
        continue
      }
      candidate.push(byte)
      if (candidate.length === 9) {
        if (!isImprovHeader(candidate)) {
          mode = 'noise'
        } else {
          expectedLength = 9 + candidate[8] + 1 // 已收 9 字节：再收 N 字节数据 + 1 字节校验和
          mode = 'frame'
        }
      }
      continue
    }
    candidate.push(byte)
    if (candidate.length === expectedLength) {
      if (checksumValid(candidate)) frames.push(parseFrame(candidate))
      candidate = []
      mode = 'header'
    }
  }
  return frames
}

/**
 * 脚本化假设备端口：只实现真实 ImprovSerial 用到的 readable/writable 两个成员，
 * 集成测试中以 `as unknown as SerialPort` 收口注入。
 */
export class FakeImprovPort {
  readonly readable: ReadableStream<Uint8Array>
  readonly writable: WritableStream<Uint8Array>
  /** 已从写入侧解析出的完整帧序列（客户端发来的命令），供集成测试断言 */
  readonly receivedFrames: DecodedFrame[] = []

  private readonly script: FakeImprovPortScript
  private controller: ReadableStreamDefaultController<Uint8Array> | null = null
  private closed = false
  /** 写入侧尚未凑成完整帧的残片（真实 SDK 每帧一次写入，正常恒为空） */
  private pending: number[] = []

  constructor(script: FakeImprovPortScript = {}) {
    this.script = script
    this.readable = new ReadableStream<Uint8Array>({
      start: (controller) => {
        this.controller = controller
      },
    })
    this.writable = new WritableStream<Uint8Array>({
      write: (chunk) => this.onClientWrite(chunk),
    })
  }

  /** 终止 readable 流：真实 SDK 的读取循环会因此 read() 得到 done 并派发 disconnect */
  triggerDisconnect(): void {
    if (this.closed) return
    this.closed = true
    this.controller?.close()
  }

  private onClientWrite(chunk: Uint8Array): void {
    const all = [...this.pending, ...chunk]
    // 只保留最后一个换行之后的尾部：SDK 每次写入都带 0x0A 收尾，未成帧残片
    // 留到下一次写入补齐后再解析（decodeFrames 不会输出不足 10+N 的候选）
    const lastNewline = all.lastIndexOf(NEW_LINE)
    this.pending = lastNewline >= 0 ? all.slice(lastNewline + 1) : all
    for (const frame of decodeFrames(all)) {
      this.receivedFrames.push(frame)
      if (frame.type === ImprovSerialMessageType.RPC) {
        this.respondToRpc(frame.data)
      }
    }
  }

  private respondToRpc(data: number[]): void {
    if (this.script.silent) return
    switch (data[0]) {
      case RPC_COMMAND.REQUEST_CURRENT_STATE:
        this.respondCurrentState()
        break
      case RPC_COMMAND.REQUEST_INFO:
        this.respondInfo()
        break
      case RPC_COMMAND.REQUEST_WIFI_NETWORKS:
        this.respondScan()
        break
      case RPC_COMMAND.SEND_WIFI_SETTINGS:
        this.respondProvision()
        break
      default:
        // 未约定的命令不回执（KISS：串口协议只约定四条命令，未知命令行为不在本替身职责内）
        break
    }
  }

  private sendFrame(type: number, data: number[]): void {
    // 断连后 readable 已关闭不能再入队
    if (this.closed || !this.controller) return
    try {
      this.controller.enqueue(encodeFrame(type, data))
    } catch {
      // 防御：readable 可能已被外部 cancel（如测试直接 reader.cancel()），此时
      // enqueue 会抛 TypeError——连接已终结、应答无人消费，吞掉即可
    }
  }

  private respondCurrentState(): void {
    this.sendFrame(ImprovSerialMessageType.CURRENT_STATE, [this.effectiveState])
    // [command, totalLen=0] 的空 RPC_RESULT：兼容性冗余而非必需——serial.js 明言
    // "Only a provisioned device sends an RPC result"，未配网设备在状态应答后不回
    // 执 RPC_RESULT，SDK 会自行 settle 请求锁（initialize 对非 PROVISIONED 状态
    // 有内部兜底）。假设备仍回执此帧以喂饱 SDK 的 RPC 回执逻辑（行为保留，勿删）
    this.sendFrame(ImprovSerialMessageType.RPC_RESULT, [RPC_COMMAND.REQUEST_CURRENT_STATE, 0])
  }

  private respondInfo(): void {
    const info = this.effectiveInfo
    const values = [info.firmware, info.version, info.chipFamily, info.name]
    // 可选字段仅在有值时追加：null/undefined 表示设备不支持该字段
    if (info.osName != null) values.push(info.osName)
    if (info.osVersion != null) values.push(info.osVersion)
    const encoded = values.map(encodePrefixed)
    const totalLen = encoded.reduce((sum, record) => sum + record.length, 0)
    this.sendFrame(ImprovSerialMessageType.RPC_RESULT, [
      RPC_COMMAND.REQUEST_INFO,
      totalLen,
      ...encoded.flat(),
    ])
  }

  private respondScan(): void {
    if (this.script.scanSupported === false) {
      // 不支持扫描：ERROR_STATE 会让 SDK 的 pending RPC reject（UNKNOWN_RPC_COMMAND）
      this.sendFrame(ImprovSerialMessageType.ERROR_STATE, [ERROR_STATE_CODE.UNKNOWN_RPC_COMMAND])
      return
    }
    // 逐行（每个网络一条）发 RPC_RESULT，最后以空结果收尾结束多包模式
    for (const network of this.script.networks ?? []) {
      const encoded = [
        encodePrefixed(network.name),
        encodePrefixed(String(network.rssi)),
        encodePrefixed(network.secured ? 'YES' : 'NO'),
      ]
      const totalLen = encoded.reduce((sum, record) => sum + record.length, 0)
      this.sendFrame(ImprovSerialMessageType.RPC_RESULT, [
        RPC_COMMAND.REQUEST_WIFI_NETWORKS,
        totalLen,
        ...encoded.flat(),
      ])
    }
    // [command, 0] 空结果帧：SDK receivedData 模式靠 totalLen=0 的结果 resolve
    this.sendFrame(ImprovSerialMessageType.RPC_RESULT, [RPC_COMMAND.REQUEST_WIFI_NETWORKS, 0])
  }

  private respondProvision(): void {
    const outcome = this.script.provisionOutcome ?? { kind: 'ok' as const }
    if (outcome.kind !== 'ok') {
      this.sendFrame(ImprovSerialMessageType.ERROR_STATE, [ERROR_STATE_CODE.UNABLE_TO_CONNECT])
      return
    }
    // 配网时序：先上报 PROVISIONING，成功后上报 PROVISIONED 并带回跳转 URL
    this.sendFrame(ImprovSerialMessageType.CURRENT_STATE, [CURRENT_STATE_CODE.PROVISIONING])
    this.sendFrame(ImprovSerialMessageType.CURRENT_STATE, [CURRENT_STATE_CODE.PROVISIONED])
    // nextUrl 缺省为空串：没有跳转 URL 也回空串值（而非 undefined），与协议表现一致
    const url = outcome.nextUrl ?? ''
    const encoded = encodePrefixed(url)
    this.sendFrame(ImprovSerialMessageType.RPC_RESULT, [
      RPC_COMMAND.SEND_WIFI_SETTINGS,
      encoded.length,
      ...encoded,
    ])
  }

  private get effectiveState(): number {
    return this.script.initialState ?? CURRENT_STATE_CODE.READY
  }

  private get effectiveInfo() {
    return { ...DEFAULT_INFO, ...this.script.info }
  }
}
