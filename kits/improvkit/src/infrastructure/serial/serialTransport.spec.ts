import { describe, expect, it, vi } from 'vitest'
import { ImprovSerialCurrentState, PortNotReady } from 'improv-wifi-serial-sdk/dist/const.js'
import { ImprovSerial } from 'improv-wifi-serial-sdk/dist/serial.js'
import type { DomainErrorCategory } from '../../domain/errors'
import { DomainProvisioningError } from '../../domain/errors'
import type { DeviceInfo, ImprovState, Ssid } from '../../domain/types'
import {
  SerialTransport,
  createDefaultSerialDeps,
  type ImprovSessionLike,
  type SerialTransportDeps,
  type SessionInfoLike,
} from './serialTransport'

/**
 * SerialTransport 单测：注入 mock session 工厂（EventTarget 假会话，手动触发
 * 事件/控制 promise），逐条验证 transport.ts 错误投递契约与状态转换。
 * 真实 ImprovSerial 的行为验证在 src/test/integration/serialTransport.integration.spec.ts。
 */

const DEFAULT_INFO: SessionInfoLike = {
  firmware: 'fw-1',
  version: 'v1',
  name: 'dev',
  chipFamily: 'ESP32',
  osName: null,
  osVersion: null,
}

/** 端口替身：只记录 open/close 调用，readable/writable 仅供默认 Session 冒烟用 */
class FakePortStub {
  openCalls: number[] = []
  closeCalls = 0
  readonly readable = new ReadableStream<Uint8Array>()
  readonly writable = new WritableStream<Uint8Array>()

  async open(options: { baudRate: number }): Promise<void> {
    this.openCalls.push(options.baudRate)
  }

  async close(): Promise<void> {
    this.closeCalls += 1
  }
}

/**
 * 假会话：EventTarget 子类，可脚本化 initialize/provision/scan 行为，
 * 并可手动派发 state-changed / error-changed / disconnect 事件。
 */
class FakeSession extends EventTarget implements ImprovSessionLike {
  info: SessionInfoLike | undefined
  state: number | undefined
  nextUrl: string | undefined
  initializeCalls = 0
  closeCalls = 0
  provisionCalls: Array<[string, string]> = []
  scanCalls = 0

  initBehavior: () => Promise<SessionInfoLike> = async () => DEFAULT_INFO
  closeBehavior: () => Promise<void> = async () => {}
  provisionBehavior: (ssid: string, password: string) => Promise<void> = async () => {}
  scanBehavior: () => Promise<Ssid[]> = async () => []

  async initialize(): Promise<SessionInfoLike> {
    this.initializeCalls += 1
    return this.initBehavior()
  }

  async close(): Promise<void> {
    this.closeCalls += 1
    return this.closeBehavior()
  }

  async provision(ssid: string, password: string): Promise<void> {
    this.provisionCalls.push([ssid, password])
    return this.provisionBehavior(ssid, password)
  }

  async scan(): Promise<Ssid[]> {
    this.scanCalls += 1
    return this.scanBehavior()
  }

  /** 派发 CURRENT_STATE 事件（detail=数值） */
  emitStateCode(code: number): void {
    this.state = code
    this.dispatchEvent(new CustomEvent('state-changed', { detail: code }))
  }

  /** 派发 error-changed 事件（detail=错误码数值） */
  emitErrorCode(code: number): void {
    this.dispatchEvent(new CustomEvent('error-changed', { detail: code }))
  }

  /** 派发物理断开事件 */
  emitDisconnect(): void {
    this.dispatchEvent(new Event('disconnect'))
  }
}

/** 组装 transport + 可替换的假会话/假端口 */
function makeHarness() {
  const port = new FakePortStub()
  let session = new FakeSession()
  const deps: SerialTransportDeps = {
    requestPort: async () => port as unknown as SerialPort,
    // 记录 openPort 收到的波特率（注入版 openPort 不真正打开端口）
    openPort: async (_port, baudRate) => {
      port.openCalls.push(baudRate)
    },
    createSession: () => session,
  }
  const transport = new SerialTransport(deps)
  return {
    transport,
    port,
    get session() {
      return session
    },
    replaceSession(next: FakeSession) {
      session = next
    },
  }
}

describe('SerialTransport.connect', () => {
  it('resolves with mapped DeviceInfo, opens the port at 115200 and reaches READY', async () => {
    const { transport, port, session } = makeHarness()

    const info = await transport.connect()

    expect(info).toEqual<DeviceInfo>({
      name: 'dev',
      firmware: 'fw-1',
      version: 'v1',
      chipFamily: 'ESP32',
      osName: null,
      osVersion: null,
    })
    expect(transport.state).toBe('READY')
    // Improv Wi-Fi Serial 协议约定波特率 115200
    expect(port.openCalls).toEqual([115200])
    expect(session.initializeCalls).toBe(1)
  })

  it('switches to CONNECTING while initialize is pending, and only to READY after it settles', async () => {
    const { transport, session } = makeHarness()
    let resolveInit: (info: SessionInfoLike) => void = () => {}
    session.initBehavior = () => new Promise<SessionInfoLike>((resolve) => (resolveInit = resolve))

    const connecting = transport.connect()
    // requestPort 是异步的：等微任务推进到 setState('CONNECTING') 后再断言
    await vi.waitFor(() => expect(transport.state).toBe('CONNECTING'))

    resolveInit(DEFAULT_INFO)
    await connecting
    expect(transport.state).toBe('READY')
  })

  it.each([
    ['PortNotReady', new PortNotReady()],
    ['not-detected error', new Error('Improv Wi-Fi Serial not detected')],
    ['arbitrary error', new Error('boom')],
  ])(
    'rejects NOT_IMPROV_DEVICE with state ERROR before rejection and best-effort cleanup (%s)',
    async (_label, cause) => {
      const { transport, port, session } = makeHarness()
      session.initBehavior = async () => {
        throw cause
      }

      let stateAtReject: ImprovState = 'IDLE'
      const err = (await transport.connect().catch((e: DomainProvisioningError) => {
        stateAtReject = transport.state
        return e
      })) as DomainProvisioningError

      expect(err).toBeInstanceOf(DomainProvisioningError)
      expect(err.category).toBe('NOT_IMPROV_DEVICE')
      expect(stateAtReject).toBe('ERROR')
      // 尽力清理：会话与端口都尝试关闭（fake 端口无 close 时也要被吞掉）
      expect(session.closeCalls).toBe(1)
      expect(port.closeCalls).toBe(1)
    },
  )

  it('surfaces a STOPPED initial state as ERROR plus onError(DEVICE_WIFI_DISABLED) during connect', async () => {
    const { transport, session } = makeHarness()
    const errors: DomainErrorCategory[] = []
    transport.onError((category) => errors.push(category))
    session.initBehavior = async () => {
      // 设备开机即 STOPPED：connect 订阅先于 initialize，此事件必须被观察到
      session.emitStateCode(ImprovSerialCurrentState.STOPPED)
      return DEFAULT_INFO
    }

    await transport.connect()

    expect(errors).toEqual(['DEVICE_WIFI_DISABLED'])
    // connect 成功收尾强制 READY；STOPPED 的持久信号是 onError 而非最终状态
    expect(transport.state).toBe('READY')
  })

  it('maps a user-cancelled device picker (NotFoundError) to REQUEST_CANCELLED and stays IDLE', async () => {
    const createSession = vi.fn(() => new FakeSession())
    const transport = new SerialTransport({
      // Chrome 取消设备选择器：requestPort reject 一个 NotFoundError DOMException（Web Serial 规范）
      requestPort: async () => {
        throw new DOMException('request cancelled', 'NotFoundError')
      },
      openPort: async () => {},
      createSession,
    })

    await expect(transport.connect()).rejects.toMatchObject({ category: 'REQUEST_CANCELLED' })

    // 取消不是会话故障：状态保持 IDLE、未创建会话，界面可直接再次发起连接
    expect(transport.state).toBe('IDLE')
    expect(createSession).not.toHaveBeenCalled()
  })

  it('leaks non-cancel requestPort errors as-is (host environment faults)', async () => {
    const boom = new Error('serial API unavailable')
    const transport = new SerialTransport({
      requestPort: async () => {
        throw boom
      },
      openPort: async () => {},
      createSession: () => new FakeSession(),
    })

    // 设备选择器之外的宿主异常原样外泄、不加映射，交由上层兜底；同样不改状态
    await expect(transport.connect()).rejects.toBe(boom)
    expect(transport.state).toBe('IDLE')
  })

  it('rejects a reentrant connect without disturbing the in-flight session', async () => {
    const { transport, session } = makeHarness()
    let resolveInit: (info: SessionInfoLike) => void = () => {}
    session.initBehavior = () => new Promise<SessionInfoLike>((resolve) => (resolveInit = resolve))

    const first = transport.connect()
    await vi.waitFor(() => expect(transport.state).toBe('CONNECTING'))

    // 重入：进行中的 connect 期间再次调用必须被拒绝，且不触碰在途会话
    await expect(transport.connect()).rejects.toMatchObject({
      category: 'UNKNOWN_ERROR',
      message: 'connect already in progress',
    })

    resolveInit(DEFAULT_INFO)
    await expect(first).resolves.toEqual({
      name: 'dev',
      firmware: 'fw-1',
      version: 'v1',
      chipFamily: 'ESP32',
      osName: null,
      osVersion: null,
    })
    expect(transport.state).toBe('READY')
    expect(session.initializeCalls).toBe(1) // 在途会话未被重入调用影响
  })

  it('still rejects re-entry while an active session is READY (self-heal only touches stale sessions)', async () => {
    const { transport, session } = makeHarness()
    await transport.connect()

    // 活跃会话（未断连未关闭）期间重入仍被入口守卫拒绝，F4 语义不变；
    // 陈旧会话自愈不得误伤正常会话
    await expect(transport.connect()).rejects.toMatchObject({
      category: 'UNKNOWN_ERROR',
      message: 'connect already in progress',
    })
    expect(session.initializeCalls).toBe(1)
    expect(transport.state).toBe('READY')
  })

  it("lets a stale generation's cleanup keep the newer generation's portRef intact (no port leak)", async () => {
    // 第一代 connect 的 openPort 被可控 promise 挂起（此时 state 仍 IDLE、无
    // 会话，入口守卫存在窗口）；第二代在窗口内完整提交进入 READY。随后释放
    // 第一代 openPort → 其代际校验失败走过期清理。旧代清理不得无条件清掉
    // portRef——那会把第二代已持有的端口引用一并清掉，导致其 close() 跳过
    // 物理端口关闭（泄漏）。
    const ports = [new FakePortStub(), new FakePortStub()]
    const sessions = [new FakeSession(), new FakeSession()]
    let requestCount = 0
    // 可控 promise 挂起第一代 openPort；box 形式承载 resolver（TS 6 闭包捕获
    // 分析会把闭包赋值的裸 let 收窄为 never，属性访问不受影响）
    const firstOpenGate: { release: (() => void) | null } = { release: null }
    const deps: SerialTransportDeps = {
      requestPort: async () => {
        const port = ports[requestCount]
        requestCount += 1
        return port as unknown as SerialPort
      },
      openPort: async (port, _baudRate) => {
        if (port === (ports[0] as unknown as SerialPort)) {
          await new Promise<void>((resolve) => (firstOpenGate.release = resolve))
        }
      },
      createSession: (port) => {
        const index = ports.findIndex((p) => p === (port as unknown as FakePortStub))
        return sessions[index]
      },
    }
    const transport = new SerialTransport(deps)

    const first = transport.connect()
    await vi.waitFor(() => expect(firstOpenGate.release).not.toBeNull())

    // 第二代在窗口内完成：端口、会话、订阅全部提交，进入 READY
    const second = await transport.connect()
    expect(transport.state).toBe('READY')
    expect(second).toBeTruthy()

    // 释放第一代的 openPort：代际不匹配 → 过期清理必须只弃自己的端口引用
    firstOpenGate.release?.()
    await expect(first).rejects.toMatchObject({ category: 'UNKNOWN_ERROR' })

    // 第二代的端口仍被持有，close 时恰好关闭一次；若旧代清理误清了 portRef，
    // 这里会跳过端口关闭 → closeCalls 为 0（泄漏回归点）
    await transport.close()
    expect(sessions[1].closeCalls).toBe(1)
    expect(ports[0].closeCalls).toBe(1) // 第一代自己的端口由过期清理关闭
    expect(ports[1].closeCalls).toBe(1) // 第二代端口必须被 close() 关闭一次
  })

  it('clears the session reference on connect failure (no zombie session RPCs afterwards)', async () => {
    const { transport, session } = makeHarness()
    session.initBehavior = async () => {
      throw new Error('Improv Wi-Fi Serial not detected')
    }

    await expect(transport.connect()).rejects.toMatchObject({ category: 'NOT_IMPROV_DEVICE' })

    // 失败清理置 session = null + closed 标记：后续 scan/provision 走「无活跃
    // 会话」守卫，而不是对死会话发 RPC
    await expect(transport.scan()).rejects.toMatchObject({
      category: 'UNKNOWN_ERROR',
      message: 'scan requires an active session',
    })
    expect(session.scanCalls).toBe(0)
    await expect(transport.provision('a', 'b')).rejects.toMatchObject({ category: 'UNKNOWN_ERROR' })
    expect(session.provisionCalls).toEqual([])
  })
})

describe('SerialTransport state mapping (state-changed)', () => {
  it.each([
    [ImprovSerialCurrentState.READY, 'READY'],
    [ImprovSerialCurrentState.PROVISIONING, 'PROVISIONING'],
    [ImprovSerialCurrentState.PROVISIONED, 'PROVISIONED'],
  ] as const)('maps CURRENT_STATE code %d to %s', async (code, expected) => {
    const { transport, session } = makeHarness()
    await transport.connect()

    session.emitStateCode(code)

    expect(transport.state).toBe(expected)
  })

  it('ignores an undefined state code instead of inventing a meaning', async () => {
    const { transport, session } = makeHarness()
    await transport.connect()

    session.emitStateCode(0x01)

    expect(transport.state).toBe('READY')
  })
})

describe('SerialTransport subscription contract', () => {
  it('never replays the current state on subscribe and returns an unsubscribe function', async () => {
    const { transport, session } = makeHarness()
    const seen: ImprovState[] = []
    const unsubscribe = transport.onStateChange((state) => seen.push(state))

    // 订阅不重放当前值（初始 IDLE 不回调）
    expect(seen).toEqual([])

    await transport.connect()
    expect(seen[0]).toBe('CONNECTING')
    expect(seen[seen.length - 1]).toBe('READY')

    const before = seen.length
    unsubscribe()
    session.emitStateCode(ImprovSerialCurrentState.PROVISIONING)
    expect(seen.length).toBe(before)
  })

  it('does not forward error-changed to onError (operation failures flow through promise rejection)', async () => {
    const { transport, session } = makeHarness()
    const errors: DomainErrorCategory[] = []
    transport.onError((category) => errors.push(category))
    await transport.connect()

    session.emitErrorCode(0x03)

    expect(errors).toEqual([])
  })
})

describe('SerialTransport disconnect handling', () => {
  it('reports DISCONNECTED and switches to ERROR when an established session disconnects', async () => {
    const { transport, session } = makeHarness()
    const errors: DomainErrorCategory[] = []
    transport.onError((category) => errors.push(category))
    await transport.connect()

    session.emitDisconnect()

    expect(transport.state).toBe('ERROR')
    expect(errors).toEqual(['DISCONNECTED'])
  })

  it('does not report DISCONNECTED for a disconnect that is part of a failing connect', async () => {
    const { transport, session } = makeHarness()
    const errors: DomainErrorCategory[] = []
    transport.onError((category) => errors.push(category))
    session.initBehavior = async () => {
      // initialize 期间设备断线：属于该次 connect 失败的一部分，由 reject 统一上报
      session.emitDisconnect()
      throw new Error('Improv Wi-Fi Serial not detected')
    }

    await expect(transport.connect()).rejects.toMatchObject({ category: 'NOT_IMPROV_DEVICE' })

    expect(errors).toEqual([])
    expect(transport.state).toBe('ERROR')
  })

  it('ignores a disconnect arriving after close (no false DISCONNECTED report)', async () => {
    const { transport, session } = makeHarness()
    const errors: DomainErrorCategory[] = []
    transport.onError((category) => errors.push(category))
    await transport.connect()
    await transport.close()

    session.emitDisconnect()

    expect(errors).toEqual([])
    // close 不改变状态，保持 READY
    expect(transport.state).toBe('READY')
  })

  it('merges a hanging RPC failure after physical disconnect into a single DISCONNECTED report', async () => {
    const { transport, session } = makeHarness()
    const errors: DomainErrorCategory[] = []
    transport.onError((category) => errors.push(category))
    await transport.connect()
    let rejectScan: (cause: unknown) => void = () => {}
    session.scanBehavior = () => new Promise<Ssid[]>((_resolve, reject) => (rejectScan = reject))

    const pending = transport.scan() // 挂起的扫描 RPC（真实场景中 30 秒后才失败）
    session.emitDisconnect() // 物理断连：报 DISCONNECTED 并进入 ERROR
    rejectScan('TIMEOUT') // 挂起 RPC 最终以 TIMEOUT 失败

    // 合并语义（transport.ts 契约）：断连期间挂起的操作以 DISCONNECTED 统一
    // reject，不再二次 setState / onError，UI 只收到一次断连事实
    await expect(pending).rejects.toMatchObject({ category: 'DISCONNECTED' })
    expect(errors).toEqual(['DISCONNECTED'])
    expect(transport.state).toBe('ERROR')
  })

  it('allows a direct reconnect after physical disconnect without an explicit close (stale session self-heal)', async () => {
    const { transport, port, session, replaceSession } = makeHarness()
    const errors: DomainErrorCategory[] = []
    transport.onError((category) => errors.push(category))
    await transport.connect()
    const oldSession = session
    session.emitDisconnect()
    expect(transport.state).toBe('ERROR')
    expect(errors).toEqual(['DISCONNECTED'])

    // 断连后不调 close 直接 connect：入口守卫必须自愈非活跃会话（退订 → 尽力
    // 关闭 → 清空引用），而不是永久误报 'connect already in progress'
    replaceSession(new FakeSession())
    await transport.connect()

    expect(transport.state).toBe('READY')
    expect(session.initializeCalls).toBe(1)
    // 旧会话被自愈关闭，且监听已退订：对旧会话再派发 disconnect 不得新增
    // DISCONNECTED 上报，也不得影响新会话
    expect(oldSession.closeCalls).toBe(1)
    oldSession.emitDisconnect()
    expect(errors).toEqual(['DISCONNECTED'])
    expect(transport.state).toBe('READY')
    // 自愈只关会话不碰物理端口（断连时端口已终结，portRef 已由 onDisconnect
    // 置空）；新会话的端口在 close 时补齐释放
    await transport.close()
    expect(port.closeCalls).toBe(1)
  })
})

describe('SerialTransport.scan', () => {
  it('resolves with the network list returned by the session', async () => {
    const { transport, session } = makeHarness()
    await transport.connect()
    const networks: Ssid[] = [
      { name: 'b-net', rssi: -40, secured: true },
      { name: 'a-net', rssi: -50, secured: false },
    ]
    session.scanBehavior = async () => networks

    await expect(transport.scan()).resolves.toEqual(networks)
    expect(session.scanCalls).toBe(1)
  })

  it('degrades to null on UNKNOWN_COMMAND without touching state', async () => {
    const { transport, session } = makeHarness()
    await transport.connect()
    // SDK 对不支持的扫描以 UNKNOWN_RPC_COMMAND 消息 reject（见 errors.ts 反查表）
    session.scanBehavior = async () => {
      throw 'UNKNOWN_RPC_COMMAND'
    }

    await expect(transport.scan()).resolves.toBeNull()
    // 降级为手动输入 SSID，不是错误：不进 ERROR、不走 onError
    expect(transport.state).toBe('READY')
  })

  it('rejects with the mapped category after switching state to ERROR first', async () => {
    const { transport, session } = makeHarness()
    await transport.connect()
    session.scanBehavior = async () => {
      throw 'TIMEOUT'
    }
    let stateAtReject: ImprovState = 'IDLE'
    const err = (await transport.scan().catch((e: DomainProvisioningError) => {
      stateAtReject = transport.state
      return e
    })) as DomainProvisioningError

    expect(stateAtReject).toBe('ERROR')
    expect(err.category).toBe('TIMEOUT')
    expect(transport.state).toBe('ERROR')
  })

  it('rejects when never connected', async () => {
    const { transport } = makeHarness()

    await expect(transport.scan()).rejects.toMatchObject({ category: 'UNKNOWN_ERROR' })
  })
})

describe('SerialTransport.provision', () => {
  it('provisions and returns the next URL read from the session', async () => {
    const { transport, session } = makeHarness()
    await transport.connect()
    session.provisionBehavior = async () => {
      // SDK 配网成功后把跳转 URL 存在 session.nextUrl；方法本身不返回值
      session.nextUrl = 'https://example.com/setup'
    }

    await expect(transport.provision('MyWiFi', 'secret')).resolves.toEqual({
      nextUrl: 'https://example.com/setup',
    })
    expect(session.provisionCalls).toEqual([['MyWiFi', 'secret']])
  })

  it('maps an empty-string next URL to undefined', async () => {
    const { transport, session } = makeHarness()
    await transport.connect()
    session.provisionBehavior = async () => {
      session.nextUrl = '' // 设备没有给出跳转 URL
    }

    await expect(transport.provision('a', 'b')).resolves.toEqual({})
  })

  it('rejects with the mapped category after switching state to ERROR first', async () => {
    const { transport, session } = makeHarness()
    await transport.connect()
    session.provisionBehavior = async () => {
      throw 'UNABLE_TO_CONNECT'
    }
    let stateAtReject: ImprovState = 'IDLE'
    const err = (await transport
      .provision('MyWiFi', 'wrong')
      .catch((e: DomainProvisioningError) => {
        stateAtReject = transport.state
        return e
      })) as DomainProvisioningError

    expect(stateAtReject).toBe('ERROR')
    expect(err.category).toBe('UNABLE_TO_CONNECT')
    expect(transport.state).toBe('ERROR')
  })

  it('maps an unrecognised rejection (e.g. UNKNOWN_ERROR (254)) to UNKNOWN_ERROR', async () => {
    const { transport, session } = makeHarness()
    await transport.connect()
    session.provisionBehavior = async () => {
      throw 'UNKNOWN_ERROR (254)'
    }

    await expect(transport.provision('a', 'b')).rejects.toMatchObject({ category: 'UNKNOWN_ERROR' })
    expect(transport.state).toBe('ERROR')
  })

  it('rejects when never connected', async () => {
    const { transport } = makeHarness()

    await expect(transport.provision('a', 'b')).rejects.toMatchObject({ category: 'UNKNOWN_ERROR' })
  })
})

describe('SerialTransport.close', () => {
  it('is idempotent: repeated calls only release the session once', async () => {
    const { transport, session } = makeHarness()
    await transport.connect()

    await transport.close()
    await transport.close()

    expect(session.closeCalls).toBe(1)
  })

  it('is a no-op when never connected, leaving state IDLE', async () => {
    const { transport } = makeHarness()

    await transport.close()

    expect(transport.state).toBe('IDLE')
  })

  it('unsubscribes before closing so the close-triggered disconnect stays silent', async () => {
    const { transport, session } = makeHarness()
    const errors: DomainErrorCategory[] = []
    transport.onError((category) => errors.push(category))
    await transport.connect()
    // 模拟真实 SDK：session.close() 会 cancel 读取流并派发 disconnect
    session.closeBehavior = async () => {
      session.emitDisconnect()
    }

    await transport.close()

    expect(errors).toEqual([])
  })

  it('allows a fresh connect on a new session after close (resources reusable)', async () => {
    const { transport, session, replaceSession } = makeHarness()
    await transport.connect()
    await transport.close()

    replaceSession(new FakeSession())
    await transport.connect()

    expect(session.initializeCalls).toBe(1)
    expect(transport.state).toBe('READY')
  })

  it('closes the physical port on close (transport completes the SDK port lifecycle)', async () => {
    const { transport, port } = makeHarness()
    await transport.connect()

    await transport.close()

    // 上游 ImprovSerial.close() 只 cancel 读取流、不关物理端口；由 transport
    // 层在会话关闭后补齐端口释放
    expect(port.closeCalls).toBe(1)
  })

  it('treats a mid-session disconnect as port termination (no double close attempt)', async () => {
    const { transport, port, session } = makeHarness()
    await transport.connect()
    session.emitDisconnect()

    await transport.close()

    // 断连已终结物理端口：close 不再尝试关闭已失效的端口
    expect(port.closeCalls).toBe(0)
  })
})

describe('createDefaultSerialDeps', () => {
  it('opens the port with the given baud rate', async () => {
    const deps = createDefaultSerialDeps()
    const port = new FakePortStub()

    await deps.openPort(port as unknown as SerialPort, 9600)

    expect(port.openCalls).toEqual([9600])
  })

  it('requests the port through navigator.serial', async () => {
    const port = new FakePortStub()
    const requestPort = vi.fn(async () => port as unknown as SerialPort)
    const original = navigator.serial
    Object.defineProperty(navigator, 'serial', {
      value: { requestPort },
      configurable: true,
    })
    try {
      const deps = createDefaultSerialDeps()
      await expect(deps.requestPort()).resolves.toBe(port)
      expect(requestPort).toHaveBeenCalledTimes(1)
    } finally {
      Object.defineProperty(navigator, 'serial', { value: original, configurable: true })
    }
  })

  it('creates a real ImprovSerial session for the port (not mocked)', () => {
    const deps = createDefaultSerialDeps()
    const port = new FakePortStub()

    const session = deps.createSession(port as unknown as SerialPort)

    expect(session).toBeInstanceOf(ImprovSerial)
    expect(session).toBeInstanceOf(EventTarget)
  })
})
