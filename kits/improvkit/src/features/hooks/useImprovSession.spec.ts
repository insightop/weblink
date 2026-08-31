import { StrictMode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DomainProvisioningError } from '../../domain/errors'
import type { DomainErrorCategory } from '../../domain/errors'
import type {
  ConsolePort,
  DeviceInfo,
  ImprovState,
  ProvisionResult,
  Ssid,
} from '../../domain/types'
import type { ErrorListener, IImprovTransport, StateListener } from '../../domain/transport'
import { SCAN_GRACE_PERIOD, useImprovSession } from './useImprovSession'

// happy-dom 环境下 process 仍是 Node 全局（vitest 不改写），此处以类型断言访问，
// 用于显式捕获动作链逃逸出的 unhandled rejection
declare const process: {
  on(event: 'unhandledRejection', listener: (reason: unknown) => void): unknown
  off(event: 'unhandledRejection', listener: (reason: unknown) => void): unknown
}

const DEVICE_INFO: DeviceInfo = {
  name: 'improv-test',
  firmware: '1.0.0',
  version: '1.0.0',
  chipFamily: 'ESP32',
  osName: 'FreeRTOS',
  osVersion: '1.2.3',
}

const NETWORKS: Ssid[] = [
  { name: 'home-5g', rssi: -42, secured: true },
  { name: 'guest', rssi: -67, secured: false },
]

/** 可控 promise：测试在 act 内放行，精确观察 busy 等中间态 */
function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
} {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/**
 * 手写 FakeTransport：implements IImprovTransport，行为由各测试编排。
 * 支持持续扫描：subscribeSSIDs 记录订阅者，测试经 emitScan 推送结果。
 */
class FakeTransport implements IImprovTransport {
  state: ImprovState = 'IDLE'
  readonly connect = vi.fn<() => Promise<DeviceInfo>>()
  readonly scan = vi.fn<() => Promise<Ssid[] | null>>()
  readonly provision = vi.fn<(ssid: string, password: string) => Promise<ProvisionResult>>()
  readonly enterConsole = vi.fn<() => Promise<ConsolePort>>()
  readonly exitConsole = vi.fn<() => Promise<void>>()
  readonly resetDevice = vi.fn<() => Promise<void>>()
  readonly close = vi.fn(async () => {})
  readonly subscribeSSIDs =
    vi.fn<(onChange: (ssids: Ssid[] | null) => void) => () => Promise<void>>()

  readonly ssidSubscribers = new Set<(ssids: Ssid[] | null) => void>()
  /** 当前有效的持续扫描取消函数（subscribeSSIDs 返回） */
  activeSsidCancel: (() => Promise<void>) | null = null

  private readonly stateListeners = new Set<StateListener>()
  private readonly errorListeners = new Set<ErrorListener>()

  constructor() {
    // 默认行为在构造时装配：subscribe 记录订阅者；测试经 emitScan 推送
    this.subscribeSSIDs.mockImplementation((onChange) => {
      this.ssidSubscribers.add(onChange)
      const cancel = async () => {
        this.ssidSubscribers.delete(onChange)
      }
      this.activeSsidCancel = cancel
      return cancel
    })
    // 控制台模式默认 no-op：返回空端口（readable/writable 为 null），测试可经 mockImplementation 覆盖
    this.enterConsole.mockImplementation(async () => ({ readable: null, writable: null }))
    this.exitConsole.mockImplementation(async () => {})
  }

  onStateChange(listener: StateListener): () => void {
    this.stateListeners.add(listener)
    return () => {
      this.stateListeners.delete(listener)
    }
  }

  onError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener)
    return () => {
      this.errorListeners.delete(listener)
    }
  }

  /** 测试辅助：模拟传输层状态推进（真实传输经 SDK 事件驱动） */
  emitState(next: ImprovState): void {
    this.state = next
    for (const listener of this.stateListeners) listener(next)
  }

  /** 测试辅助：模拟非操作绑定的异步传输错误（物理断连等） */
  emitError(category: DomainErrorCategory): void {
    for (const listener of this.errorListeners) listener(category)
  }

  /** 测试辅助：当前挂着的 state+error 订阅数 */
  listenerCount(): number {
    return this.stateListeners.size + this.errorListeners.size
  }

  /** 测试辅助：当前挂着的持续扫描订阅数 */
  scanSubscriberCount(): number {
    return this.ssidSubscribers.size
  }

  /** 测试辅助：向所有持续扫描订阅者推送一次扫描结果 */
  emitScan(ssids: Ssid[] | null): void {
    for (const fn of this.ssidSubscribers) fn(ssids)
  }

  /** 测试辅助：模拟真实传输的成功 connect（resolve 时已进入 READY 并携带设备信息） */
  scriptConnectSuccess(): void {
    this.connect.mockImplementation(async () => {
      this.emitState('READY')
      return DEVICE_INFO
    })
  }

  /** 测试辅助：模拟「连接时设备已配网」——connect resolve 时状态已是 PROVISIONED */
  scriptConnectProvisioned(): void {
    this.connect.mockImplementation(async () => {
      this.emitState('PROVISIONED')
      return DEVICE_INFO
    })
  }
}

/** 装配 hook：每次 createTransport 调用都产生新 fake 并记录，便于断言重建时机 */
function setup() {
  const fakes: FakeTransport[] = []
  const utils = renderHook(() =>
    useImprovSession({
      createTransport: () => {
        const fake = new FakeTransport()
        fakes.push(fake)
        return fake
      },
    }),
  )
  return {
    ...utils,
    fakes,
    /** 当前生效的传输（挂载效应或 reset 后惰性重建的最新一个） */
    current: (): FakeTransport => fakes[fakes.length - 1],
  }
}

// 宽限期测试需要推进时钟；全局用真实时钟，仅在需要时局部启用假时钟
describe('useImprovSession', () => {
  it('初始状态：IDLE、未扫描、无设备信息/错误/URL、不忙、宽限未过，挂载即订阅传输事件', () => {
    const { result, current } = setup()
    expect(result.current.state).toBe('IDLE')
    expect(result.current.deviceInfo).toBeUndefined()
    expect(result.current.networks).toBeUndefined()
    expect(result.current.scanUnavailable).toBe(false)
    expect(result.current.scanGraceExpired).toBe(false)
    expect(result.current.errorCategory).toBeUndefined()
    expect(result.current.lastUrl).toBeUndefined()
    expect(result.current.busy).toBe(false)
    expect(current().listenerCount()).toBe(2) // onStateChange + onError 各一
    // IDLE 时未进入持续扫描
    expect(current().scanSubscriberCount()).toBe(0)
  })

  it('挂载创建传输；订阅不重放，初始状态来自对 transport.state 的显式读取', () => {
    const fake = new FakeTransport()
    fake.state = 'READY' // 模拟订阅时刻已存在的会话状态
    const { result } = renderHook(() => useImprovSession({ createTransport: () => fake }))
    expect(result.current.state).toBe('READY')
    // READY 应触发持续扫描订阅
    expect(fake.scanSubscriberCount()).toBe(1)
    // 此后状态推进完全由事件驱动
    act(() => fake.emitState('CONNECTING'))
    expect(result.current.state).toBe('CONNECTING')
  })

  it('connect 成功进入 READY：自动订阅持续扫描，期间 busy 保持 true，无自动一次性 scan', async () => {
    const { result, current } = setup()
    const fake = current()
    const connectGate = deferred<DeviceInfo>()
    fake.connect.mockImplementation(async () => {
      fake.emitState('READY')
      return connectGate.promise
    })

    act(() => result.current.connect())
    expect(result.current.busy).toBe(true)
    expect(fake.connect).toHaveBeenCalledTimes(1)

    await act(async () => {
      connectGate.resolve(DEVICE_INFO)
    })
    expect(result.current.state).toBe('READY')
    expect(result.current.deviceInfo).toEqual(DEVICE_INFO)
    // 持续扫描取代一次性 scan：connect 后订阅 subscribeSSIDs，而非调用 scan
    expect(fake.scan).not.toHaveBeenCalled()
    expect(fake.scanSubscriberCount()).toBe(1)
    expect(result.current.busy).toBe(false)

    // 持续扫描结果经回调落地
    await act(async () => {
      fake.emitScan(NETWORKS)
    })
    expect(result.current.networks).toEqual(NETWORKS)
    expect(result.current.scanUnavailable).toBe(false)
  })

  it('connect 成功但设备已配网（PROVISIONED）：不进入持续扫描', async () => {
    const { result, current } = setup()
    const fake = current()
    fake.scriptConnectProvisioned()

    await act(async () => {
      result.current.connect()
    })
    expect(result.current.state).toBe('PROVISIONED')
    expect(fake.scanSubscriberCount()).toBe(0)
    expect(fake.scan).not.toHaveBeenCalled()
    expect(result.current.busy).toBe(false)
  })

  it('connect 失败（领域错误）：按类别记录，不订阅持续扫描', async () => {
    const fake = new FakeTransport()
    fake.connect.mockImplementation(async () => {
      fake.emitState('ERROR')
      throw new DomainProvisioningError('TIMEOUT')
    })
    const { result } = renderHook(() => useImprovSession({ createTransport: () => fake }))

    await act(async () => {
      result.current.connect()
    })
    expect(result.current.state).toBe('ERROR')
    expect(result.current.errorCategory).toBe('TIMEOUT')
    expect(fake.scanSubscriberCount()).toBe(0)
    expect(result.current.busy).toBe(false)
  })

  it('connect 失败（非领域异常）：兜底为 UNKNOWN_ERROR', async () => {
    const fake = new FakeTransport()
    fake.connect.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useImprovSession({ createTransport: () => fake }))

    await act(async () => {
      result.current.connect()
    })
    expect(result.current.errorCategory).toBe('UNKNOWN_ERROR')
    expect(result.current.busy).toBe(false)
  })

  it('connect 取消（REQUEST_CANCELLED）：静默，不记错误类别，状态由传输决定（IDLE）', async () => {
    const fake = new FakeTransport()
    fake.connect.mockRejectedValue(new DomainProvisioningError('REQUEST_CANCELLED'))
    const { result } = renderHook(() => useImprovSession({ createTransport: () => fake }))

    await act(async () => {
      result.current.connect()
    })
    expect(result.current.errorCategory).toBeUndefined()
    expect(result.current.state).toBe('IDLE')
    expect(fake.scanSubscriberCount()).toBe(0)
    expect(result.current.busy).toBe(false)
  })

  it('持续扫描回调 null（设备不支持扫描）：scanUnavailable 降级，状态保持 READY，不算错误', async () => {
    const { result, current } = setup()
    const fake = current()
    fake.scriptConnectSuccess()
    await act(async () => {
      result.current.connect()
    })

    await act(async () => {
      fake.emitScan(null)
    })
    expect(result.current.networks).toBeNull()
    expect(result.current.scanUnavailable).toBe(true)
    expect(result.current.state).toBe('READY')
    expect(result.current.errorCategory).toBeUndefined()
  })

  it('离开 READY（submitCredentials → PROVISIONED）：取消持续扫描，不再回调网络', async () => {
    const { result, current } = setup()
    const fake = current()
    fake.scriptConnectSuccess()
    fake.emitScan(NETWORKS)
    fake.provision.mockImplementation(async () => {
      fake.emitState('PROVISIONED')
      return { nextUrl: 'http://device.local' }
    })

    await act(async () => {
      result.current.connect()
    })
    await act(async () => {
      result.current.submitCredentials('home-5g', 'secret')
    })
    expect(result.current.state).toBe('PROVISIONED')
    expect(fake.scanSubscriberCount()).toBe(0) // 已取消
    // 取消后推送不再影响网络列表
    const before = result.current.networks
    act(() => fake.emitScan([{ name: 'new-net', rssi: -30, secured: false }]))
    expect(result.current.networks).toEqual(before)
  })

  it('changeWifi：PROVISIONED → READY 重新订阅持续扫描并保留表单语境', async () => {
    const { result, current } = setup()
    const fake = current()
    fake.scriptConnectSuccess()
    fake.provision.mockImplementation(async () => {
      fake.emitState('PROVISIONED')
      return { nextUrl: 'http://device.local' }
    })
    await act(async () => {
      result.current.connect()
    })
    expect(fake.scanSubscriberCount()).toBe(1)
    await act(async () => {
      fake.emitScan(NETWORKS)
    })
    await act(async () => {
      result.current.submitCredentials('home-5g', 'secret')
    })
    expect(fake.scanSubscriberCount()).toBe(0)

    act(() => result.current.changeWifi())
    expect(result.current.state).toBe('READY')
    expect(fake.scanSubscriberCount()).toBe(1) // 重新订阅
    expect(result.current.deviceInfo).toEqual(DEVICE_INFO)
    expect(result.current.networks).toEqual(NETWORKS)
  })

  it('reset：关闭并退订会话，取消持续扫描，全部状态回到初始', async () => {
    const { result, current } = setup()
    const fake = current()
    fake.scriptConnectSuccess()
    await act(async () => {
      result.current.connect()
      fake.emitScan(NETWORKS)
    })
    expect(fake.scanSubscriberCount()).toBe(1)

    act(() => result.current.reset())
    expect(result.current.state).toBe('IDLE')
    expect(result.current.deviceInfo).toBeUndefined()
    expect(result.current.networks).toBeUndefined()
    expect(result.current.scanGraceExpired).toBe(false)
    expect(result.current.errorCategory).toBeUndefined()
    expect(result.current.lastUrl).toBeUndefined()
    expect(result.current.busy).toBe(false)
    expect(fake.close).toHaveBeenCalledTimes(1)
    expect(fake.listenerCount()).toBe(0)
    expect(fake.scanSubscriberCount()).toBe(0) // 持续扫描已取消
  })

  it('refreshScan：重新触发持续扫描（重订阅即立即首扫），不产生一次性 scan', async () => {
    const { result, current } = setup()
    const fake = current()
    fake.scriptConnectSuccess()
    await act(async () => {
      result.current.connect()
    })
    // connect 已订阅一次
    expect(fake.subscribeSSIDs).toHaveBeenCalledTimes(1)
    const before = fake.subscribeSSIDs.mock.calls.length

    await act(async () => {
      result.current.refreshScan()
    })
    // refreshScan 触发重新订阅（取消原订阅后再订阅，立即开启新一轮首扫）
    expect(fake.subscribeSSIDs.mock.calls.length).toBe(before + 1)
    expect(fake.scan).not.toHaveBeenCalled()
  })

  it('onError 异步错误：记录错误类别（物理断连等非操作绑定错误）', () => {
    const { result, current } = setup()
    act(() => current().emitError('DISCONNECTED'))
    expect(result.current.errorCategory).toBe('DISCONNECTED')
  })

  it('submitCredentials 成功：记录 nextUrl，状态由传输事件驱动为 PROVISIONED', async () => {
    const { result, current } = setup()
    const fake = current()
    fake.scriptConnectSuccess()
    fake.provision.mockImplementation(async () => {
      fake.emitState('PROVISIONED')
      return { nextUrl: 'http://device.local' }
    })

    await act(async () => {
      result.current.connect()
    })
    await act(async () => {
      result.current.submitCredentials('home-5g', 'secret')
    })
    expect(fake.provision).toHaveBeenCalledWith('home-5g', 'secret')
    expect(result.current.state).toBe('PROVISIONED')
    expect(result.current.lastUrl).toBe('http://device.local')
    expect(result.current.busy).toBe(false)
  })

  it('submitCredentials 失败：记录错误类别，保留表单语境并可重试', async () => {
    const { result, current } = setup()
    const fake = current()
    fake.scriptConnectSuccess()
    fake.provision.mockImplementation(async () => {
      fake.emitState('ERROR')
      throw new DomainProvisioningError('UNABLE_TO_CONNECT')
    })

    await act(async () => {
      result.current.connect()
    })
    await act(async () => {
      fake.emitScan(NETWORKS)
    })
    await act(async () => {
      result.current.submitCredentials('home-5g', 'wrong-password')
    })
    expect(result.current.state).toBe('ERROR')
    expect(result.current.errorCategory).toBe('UNABLE_TO_CONNECT')
    expect(result.current.deviceInfo).toEqual(DEVICE_INFO)
    expect(result.current.networks).toEqual(NETWORKS)

    fake.provision.mockImplementation(async () => {
      fake.emitState('PROVISIONED')
      return { nextUrl: 'http://device.local' }
    })
    await act(async () => {
      result.current.submitCredentials('home-5g', 'correct-password')
    })
    expect(result.current.errorCategory).toBeUndefined()
    expect(result.current.lastUrl).toBe('http://device.local')
  })

  it('changeWifi：非 PROVISIONED 状态不臆造迁移', () => {
    const { result, current } = setup()
    act(() => result.current.changeWifi())
    expect(result.current.state).toBe('IDLE')
    act(() => current().emitState('READY'))
    act(() => result.current.changeWifi())
    expect(result.current.state).toBe('READY')
  })

  it('reset 后可重新连接：惰性重建全新传输并重走流程', async () => {
    const factories: Array<() => FakeTransport> = [
      () => {
        const fake = new FakeTransport()
        fake.connect.mockRejectedValue(new DomainProvisioningError('TIMEOUT'))
        return fake
      },
      () => {
        const fake = new FakeTransport()
        fake.scriptConnectSuccess()
        return fake
      },
    ]
    const fakes: FakeTransport[] = []
    const { result } = renderHook(() =>
      useImprovSession({
        createTransport: () => {
          const fake = factories[fakes.length]()
          fakes.push(fake)
          return fake
        },
      }),
    )
    const first = fakes[0]
    await act(async () => {
      result.current.connect()
    })
    expect(result.current.errorCategory).toBe('TIMEOUT')
    act(() => result.current.reset())
    expect(first.close).toHaveBeenCalledTimes(1)

    await act(async () => {
      result.current.connect()
    })
    expect(fakes).toHaveLength(2)
    expect(result.current.state).toBe('READY')
    expect(result.current.deviceInfo).toEqual(DEVICE_INFO)
    expect(fakes[1].scanSubscriberCount()).toBe(1) // 新会话进入 READY 订阅持续扫描
  })

  it('reset 后卸载：close 只调用一次（清理幂等）', () => {
    const { result, current, unmount } = setup()
    const fake = current()
    act(() => result.current.reset())
    expect(fake.close).toHaveBeenCalledTimes(1)
    unmount()
    expect(fake.close).toHaveBeenCalledTimes(1)
  })

  it('卸载清理：close + 退订，传输事件不再唤醒 hook', () => {
    const { current, unmount } = setup()
    const fake = current()
    expect(fake.listenerCount()).toBe(2)
    unmount()
    expect(fake.close).toHaveBeenCalledTimes(1)
    expect(fake.listenerCount()).toBe(0)
    expect(() => fake.emitState('READY')).not.toThrow()
  })

  it('StrictMode 双挂载：旧传输被清理，新传输接管，状态正确', () => {
    const fakes: FakeTransport[] = []
    const { result, unmount } = renderHook(
      () =>
        useImprovSession({
          createTransport: () => {
            const fake = new FakeTransport()
            fakes.push(fake)
            return fake
          },
        }),
      { wrapper: StrictMode },
    )
    expect(fakes).toHaveLength(2)
    expect(fakes[0].close).toHaveBeenCalledTimes(1)
    expect(fakes[1].close).not.toHaveBeenCalled()
    expect(result.current.state).toBe('IDLE')
    unmount()
    expect(fakes[1].close).toHaveBeenCalledTimes(1)
  })

  it('所有动作的异步异常都不逃逸为 unhandled rejection', async () => {
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason)
    }
    process.on('unhandledRejection', onUnhandled)
    try {
      const fake = new FakeTransport()
      fake.connect.mockRejectedValue(new Error('boom'))
      fake.provision.mockRejectedValue(new Error('net down'))
      const { result } = renderHook(() => useImprovSession({ createTransport: () => fake }))

      await act(async () => {
        result.current.connect()
      })
      await act(async () => {
        result.current.submitCredentials('ssid', 'password')
      })
      act(() => result.current.reset())
      expect(fake.close).toHaveBeenCalledTimes(1)

      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(unhandled).toEqual([])
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })

  it('refreshScan 重订阅期间传输同步抛错：不逃逸 unhandled rejection，busy 复位', async () => {
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason)
    }
    process.on('unhandledRejection', onUnhandled)
    try {
      const { result, current } = setup()
      const fake = current()
      fake.scriptConnectSuccess()
      await act(async () => {
        result.current.connect()
      })
      expect(fake.scanSubscriberCount()).toBe(1)
      // 刷新重订阅时让 transport 同步抛错：模拟取消旧扫描期间会话被关闭，
      // 新 subscribeSSIDs 同步拒绝（refreshScan 原本只有 try/finally，无 catch）
      fake.subscribeSSIDs.mockImplementationOnce(() => {
        throw new Error('subscribeSSIDs requires an active session')
      })
      await act(async () => {
        result.current.refreshScan()
      })
      expect(result.current.busy).toBe(false)

      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(unhandled).toEqual([])
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })
})

describe('useImprovSession 控制台模式', () => {
  it('enterConsole 成功：持有 consolePort，保留配网语境，busy 复位', async () => {
    const { result, current } = setup()
    const fake = current()
    fake.scriptConnectSuccess()
    await act(async () => {
      result.current.connect()
    })
    await act(async () => {
      fake.emitScan(NETWORKS)
    })
    const port: ConsolePort = { readable: null, writable: null }
    fake.enterConsole.mockResolvedValue(port)

    await act(async () => {
      result.current.enterConsole!()
    })
    expect(fake.enterConsole).toHaveBeenCalledTimes(1)
    expect(result.current.consolePort).toBe(port)
    // 进入控制台是"临时查看日志"：保留配网语境，退出后能恢复
    expect(result.current.deviceInfo).toEqual(DEVICE_INFO)
    expect(result.current.networks).toEqual(NETWORKS)
    expect(result.current.busy).toBe(false)
  })

  it('enterConsole 失败（领域错误）：按类别记录错误，不持有端口', async () => {
    const { result, current } = setup()
    const fake = current()
    fake.enterConsole.mockRejectedValue(new DomainProvisioningError('TIMEOUT'))

    await act(async () => {
      result.current.enterConsole!()
    })
    expect(result.current.errorCategory).toBe('TIMEOUT')
    expect(result.current.consolePort).toBeUndefined()
    expect(result.current.busy).toBe(false)
  })

  it('enterConsole 失败（非领域异常）：兜底为 UNKNOWN_ERROR', async () => {
    const { result, current } = setup()
    const fake = current()
    fake.enterConsole.mockRejectedValue(new Error('boom'))

    await act(async () => {
      result.current.enterConsole!()
    })
    expect(result.current.errorCategory).toBe('UNKNOWN_ERROR')
    expect(result.current.consolePort).toBeUndefined()
  })

  it('exitConsole 成功：清空 consolePort，恢复可配网（transport 已回 READY）', async () => {
    const { result, current } = setup()
    const fake = current()
    fake.enterConsole.mockResolvedValue({ readable: null, writable: null })
    await act(async () => {
      result.current.enterConsole!()
    })
    expect(result.current.consolePort).toBeDefined()

    // 退出控制台：transport 恢复 READY（成功即 READY，契约）
    fake.exitConsole.mockImplementation(async () => {
      fake.emitState('READY')
    })
    await act(async () => {
      result.current.exitConsole!()
    })
    expect(fake.exitConsole).toHaveBeenCalledTimes(1)
    expect(result.current.consolePort).toBeUndefined()
    expect(result.current.state).toBe('READY')
    expect(result.current.busy).toBe(false)
  })

  it('exitConsole 失败：保留 consolePort（仍在控制台），记录错误', async () => {
    const { result, current } = setup()
    const fake = current()
    fake.enterConsole.mockResolvedValue({ readable: null, writable: null })
    await act(async () => {
      result.current.enterConsole!()
    })
    fake.exitConsole.mockRejectedValue(new DomainProvisioningError('DISCONNECTED'))

    await act(async () => {
      result.current.exitConsole!()
    })
    expect(result.current.errorCategory).toBe('DISCONNECTED')
    // 退出失败：仍处于控制台，端口保留，页面继续渲染 ConsoleView
    expect(result.current.consolePort).toBeDefined()
    expect(result.current.busy).toBe(false)
  })

  it('resetConsole：复用 exitConsole 退出控制台并回到配网视图', async () => {
    const { result, current } = setup()
    const fake = current()
    fake.enterConsole.mockResolvedValue({ readable: null, writable: null })
    await act(async () => {
      result.current.enterConsole!()
    })
    fake.exitConsole.mockImplementation(async () => {
      fake.emitState('READY')
    })

    await act(async () => {
      result.current.resetConsole!()
    })
    expect(fake.exitConsole).toHaveBeenCalledTimes(1)
    expect(result.current.consolePort).toBeUndefined()
    expect(result.current.state).toBe('READY')
  })

  it('resetDevice：透传 transport.resetDevice（真实硬件复位），成功后清空控制台端口并提示重新连接', async () => {
    const { result, current } = setup()
    const fake = current()
    fake.enterConsole.mockResolvedValue({ readable: null, writable: null })
    await act(async () => {
      result.current.enterConsole!()
    })
    expect(result.current.consolePort).toBeDefined()
    fake.resetDevice.mockImplementation(async () => {
      fake.emitState('IDLE')
    })

    await act(async () => {
      result.current.resetDevice!()
    })
    expect(fake.resetDevice).toHaveBeenCalledTimes(1)
    // 复位重启设备后 Improv 会话失效：清空控制台端口，回到配网入口视图
    expect(result.current.consolePort).toBeUndefined()
    expect(result.current.state).toBe('IDLE')
    expect(result.current.busy).toBe(false)
    // 复位后提示用户重新连接
    expect(result.current.resetNotice).toBe(true)
  })

  it('resetDevice 失败（领域错误）：按类别记录错误，保留控制台端口，不提示重新连接', async () => {
    const { result, current } = setup()
    const fake = current()
    fake.enterConsole.mockResolvedValue({ readable: null, writable: null })
    await act(async () => {
      result.current.enterConsole!()
    })
    fake.resetDevice.mockRejectedValue(new DomainProvisioningError('UNKNOWN_ERROR'))

    await act(async () => {
      // resetDevice 返回 promise：调用方负责 catch，此处显式捕获避免 unhandled
      await result.current.resetDevice!().catch(() => {})
    })
    expect(result.current.errorCategory).toBe('UNKNOWN_ERROR')
    // 复位失败：仍处于控制台，端口保留，页面继续渲染 ConsoleView
    expect(result.current.consolePort).toBeDefined()
    expect(result.current.busy).toBe(false)
    expect(result.current.resetNotice).toBe(false)
  })

  it('resetDevice 失败（非领域异常）：兜底为 UNKNOWN_ERROR', async () => {
    const { result, current } = setup()
    const fake = current()
    fake.enterConsole.mockResolvedValue({ readable: null, writable: null })
    await act(async () => {
      result.current.enterConsole!()
    })
    fake.resetDevice.mockRejectedValue(new Error('boom'))

    await act(async () => {
      await result.current.resetDevice!().catch(() => {})
    })
    expect(result.current.errorCategory).toBe('UNKNOWN_ERROR')
    expect(result.current.consolePort).toBeDefined()
  })

  it('resetDevice 后 connect 重新连接：清除复位提示', async () => {
    const { result, current } = setup()
    const fake = current()
    fake.enterConsole.mockResolvedValue({ readable: null, writable: null })
    await act(async () => {
      result.current.enterConsole!()
    })
    fake.resetDevice.mockImplementation(async () => {
      fake.emitState('IDLE')
    })
    await act(async () => {
      result.current.resetDevice!()
    })
    expect(result.current.resetNotice).toBe(true)

    fake.scriptConnectSuccess()
    await act(async () => {
      result.current.connect()
    })
    expect(result.current.resetNotice).toBe(false)
  })

  it('resetDevice 返回的 promise 在传输复位完成后 resolve（busy 期间保持 pending）', async () => {
    const { result, current } = setup()
    const fake = current()
    const gate = deferred<void>()
    fake.resetDevice.mockReturnValue(gate.promise)

    let settled = false
    let returned: Promise<void> | undefined
    act(() => {
      returned = result.current.resetDevice!()
      returned.then(
        () => {
          settled = true
        },
        () => {
          settled = true
        },
      )
    })
    // 复位进行中：busy 为 true，返回的 promise 尚未 settle
    expect(result.current.busy).toBe(true)
    expect(settled).toBe(false)

    await act(async () => {
      gate.resolve()
    })
    // 复位完成：busy 复位，返回的 promise 已 resolve
    expect(settled).toBe(true)
    expect(result.current.busy).toBe(false)
    await expect(returned).resolves.toBeUndefined()
  })

  it('resetDevice 返回的 promise 在传输复位失败时 reject（错误路径可被 UI 捕获）', async () => {
    const { result, current } = setup()
    const fake = current()
    const gate = deferred<void>()
    fake.resetDevice.mockReturnValue(gate.promise)

    let returned: Promise<void> | undefined
    act(() => {
      returned = result.current.resetDevice!()
      // 立即挂 catch：避免 reject 后、断言前出现 unhandled rejection
      returned.catch(() => {})
    })
    await act(async () => {
      gate.reject(new DomainProvisioningError('UNKNOWN_ERROR'))
    })
    // 失败：busy 复位，返回的 promise reject，错误类别记录
    expect(result.current.busy).toBe(false)
    expect(result.current.errorCategory).toBe('UNKNOWN_ERROR')
    await expect(returned).rejects.toBeInstanceOf(DomainProvisioningError)
  })

  it('resetDevice 的异步异常不逃逸为 unhandled rejection', async () => {
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason)
    }
    process.on('unhandledRejection', onUnhandled)
    try {
      const fake = new FakeTransport()
      fake.resetDevice.mockRejectedValue(new Error('reset failed'))
      const { result } = renderHook(() => useImprovSession({ createTransport: () => fake }))

      await act(async () => {
        // resetDevice 现在返回 promise：调用方（UI handleReset）负责 catch，
        // 此处显式捕获以验证「返回的 promise 被消费后不产生 unhandled rejection」
        await result.current.resetDevice!().catch(() => {})
      })
      expect(result.current.errorCategory).toBe('UNKNOWN_ERROR')

      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(unhandled).toEqual([])
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })

  it('控制台模式下配网操作被拒绝：connect/refreshScan/submitCredentials 不产生传输调用', async () => {
    const { result, current } = setup()
    const fake = current()
    fake.enterConsole.mockResolvedValue({ readable: null, writable: null })
    await act(async () => {
      result.current.enterConsole!()
    })

    act(() => result.current.connect())
    act(() => result.current.refreshScan())
    act(() => result.current.submitCredentials('home-5g', 'secret'))
    expect(fake.connect).not.toHaveBeenCalled()
    expect(fake.subscribeSSIDs).not.toHaveBeenCalled()
    expect(fake.provision).not.toHaveBeenCalled()
    expect(result.current.errorCategory).toBeUndefined()
  })

  it('enterConsole 进行中再次 enterConsole：重入被拒，仅调用一次', async () => {
    const { result, current } = setup()
    const fake = current()
    const gate = deferred<ConsolePort>()
    fake.enterConsole.mockReturnValue(gate.promise)

    act(() => result.current.enterConsole!())
    act(() => result.current.enterConsole!())
    expect(fake.enterConsole).toHaveBeenCalledTimes(1)
    expect(result.current.busy).toBe(true)

    await act(async () => {
      gate.resolve({ readable: null, writable: null })
    })
    expect(result.current.consolePort).toBeDefined()
    expect(result.current.busy).toBe(false)
  })

  it('reset 时若在控制台：先 exitConsole 再 close，且清空 consolePort', async () => {
    const { result, current } = setup()
    const fake = current()
    fake.enterConsole.mockResolvedValue({ readable: null, writable: null })
    await act(async () => {
      result.current.enterConsole!()
    })
    expect(result.current.consolePort).toBeDefined()

    act(() => result.current.reset())
    expect(fake.exitConsole).toHaveBeenCalledTimes(1)
    expect(fake.close).toHaveBeenCalledTimes(1)
    expect(result.current.consolePort).toBeUndefined()
    expect(result.current.state).toBe('IDLE')
  })

  it('卸载时若在控制台：先 exitConsole 再 close（会话状态一致）', async () => {
    const { result, current, unmount } = setup()
    const fake = current()
    fake.enterConsole.mockResolvedValue({ readable: null, writable: null })
    await act(async () => {
      result.current.enterConsole!()
    })
    expect(result.current.consolePort).toBeDefined()

    unmount()
    expect(fake.exitConsole).toHaveBeenCalledTimes(1)
    expect(fake.close).toHaveBeenCalledTimes(1)
  })

  it('reset 后旧 enterConsole 的迟到结果不污染新会话（代际失效）', async () => {
    const { result, current } = setup()
    const fake = current()
    const gate = deferred<ConsolePort>()
    fake.enterConsole.mockReturnValue(gate.promise)

    act(() => result.current.enterConsole!())
    act(() => result.current.reset())
    expect(result.current.busy).toBe(false)

    await act(async () => {
      gate.resolve({ readable: null, writable: null })
    })
    expect(result.current.consolePort).toBeUndefined()
    expect(result.current.state).toBe('IDLE')
  })

  it('控制台动作的异步异常不逃逸为 unhandled rejection', async () => {
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason)
    }
    process.on('unhandledRejection', onUnhandled)
    try {
      const fake = new FakeTransport()
      fake.enterConsole.mockRejectedValue(new Error('boom'))
      fake.exitConsole.mockRejectedValue(new Error('net down'))
      const { result } = renderHook(() => useImprovSession({ createTransport: () => fake }))

      await act(async () => {
        result.current.enterConsole!()
      })
      act(() => result.current.reset())

      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(unhandled).toEqual([])
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })
})

describe('useImprovSession 首扫宽限期', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('宽限期内无结果：宽限期一到置 scanGraceExpired；之后收到网络则清空', async () => {
    const { result, current } = setup()
    const fake = current()
    fake.scriptConnectSuccess()
    await act(async () => {
      result.current.connect()
    })
    expect(result.current.scanGraceExpired).toBe(false)

    // 宽限期内仍无任何扫描结果
    act(() => {
      vi.advanceTimersByTime(SCAN_GRACE_PERIOD)
    })
    expect(result.current.scanGraceExpired).toBe(true)

    // 之后设备返回网络：宽限空态不再成立，列表落地
    await act(async () => {
      fake.emitScan(NETWORKS)
    })
    expect(result.current.networks).toEqual(NETWORKS)
    expect(result.current.scanGraceExpired).toBe(false)
  })

  it('宽限期内返回空列表：不算"未发现网络"，宽限期结束仍空才置位', async () => {
    const { result, current } = setup()
    const fake = current()
    fake.scriptConnectSuccess()
    await act(async () => {
      result.current.connect()
    })
    await act(async () => {
      fake.emitScan([]) // 空列表：宽限期内不触发空态
    })
    expect(result.current.networks).toEqual([])
    expect(result.current.scanGraceExpired).toBe(false)

    act(() => {
      vi.advanceTimersByTime(SCAN_GRACE_PERIOD)
    })
    expect(result.current.scanGraceExpired).toBe(true)
  })

  it('宽限期内返回非空网络：立即展示，宽限期结束不置空态', async () => {
    const { result, current } = setup()
    const fake = current()
    fake.scriptConnectSuccess()
    await act(async () => {
      result.current.connect()
    })
    await act(async () => {
      fake.emitScan(NETWORKS)
    })
    expect(result.current.networks).toEqual(NETWORKS)
    act(() => {
      vi.advanceTimersByTime(SCAN_GRACE_PERIOD)
    })
    expect(result.current.scanGraceExpired).toBe(false)
  })

  it('reset 后重连：上一会话的扫描结果不残留，宽限期从全新状态重新计时', async () => {
    // 预制两个传输：第一个 connect 成功并返回网络；reset 后第二个 connect 成功
    // 但不再返回网络——重连后宽限期结束应正确置空态（networksRef 必须已复位）
    const factories: Array<() => FakeTransport> = [
      () => {
        const fake = new FakeTransport()
        fake.scriptConnectSuccess()
        return fake
      },
      () => {
        const fake = new FakeTransport()
        fake.scriptConnectSuccess()
        return fake
      },
    ]
    const fakes: FakeTransport[] = []
    const { result } = renderHook(() =>
      useImprovSession({
        createTransport: () => {
          const fake = factories[fakes.length]()
          fakes.push(fake)
          return fake
        },
      }),
    )
    const first = fakes[0]
    await act(async () => {
      result.current.connect()
    })
    expect(first.scanSubscriberCount()).toBe(1)
    await act(async () => {
      first.emitScan(NETWORKS)
    })
    expect(result.current.networks).toEqual(NETWORKS)

    // reset 关闭第一个会话并复位镜像
    act(() => result.current.reset())
    expect(result.current.scanGraceExpired).toBe(false)

    // 第二个会话 connect 成功但无扫描结果：宽限期结束应置空态而不是读到残留
    const second = () => fakes[fakes.length - 1]
    await act(async () => {
      result.current.connect()
    })
    expect(fakes).toHaveLength(2)
    expect(second().scanSubscriberCount()).toBe(1)
    expect(result.current.networks).toBeUndefined()

    act(() => {
      vi.advanceTimersByTime(SCAN_GRACE_PERIOD)
    })
    expect(result.current.scanGraceExpired).toBe(true) // 无残留：正确置位
  })
})

describe('useImprovSession 并发防护与异步失效', () => {
  it('connect 进行中再次 connect：重入被拒，第二次不产生传输调用且无虚假错误', async () => {
    const { result, current } = setup()
    const fake = current()
    const connectGate = deferred<DeviceInfo>()
    fake.connect.mockReturnValue(connectGate.promise)

    act(() => result.current.connect())
    act(() => result.current.connect())

    expect(fake.connect).toHaveBeenCalledTimes(1)
    expect(result.current.busy).toBe(true)
    expect(result.current.errorCategory).toBeUndefined()

    await act(async () => {
      connectGate.resolve(DEVICE_INFO)
    })
    expect(result.current.deviceInfo).toEqual(DEVICE_INFO)
    expect(result.current.busy).toBe(false)
  })

  it('reset 后旧 connect 的迟到 reject 不污染新会话状态（代际失效）', async () => {
    const { result, current } = setup()
    const fake = current()
    const connectGate = deferred<DeviceInfo>()
    fake.connect.mockReturnValue(connectGate.promise)

    act(() => result.current.connect())
    act(() => result.current.reset())
    expect(result.current.busy).toBe(false)

    await act(async () => {
      connectGate.reject(new DomainProvisioningError('TIMEOUT'))
    })
    expect(result.current.errorCategory).toBeUndefined()
    expect(result.current.state).toBe('IDLE')
    expect(result.current.busy).toBe(false)
  })

  it('submitCredentials 进行中重复提交：被忽略，仅下发一次且无虚假错误', async () => {
    const { result, current } = setup()
    const fake = current()
    const provisionGate = deferred<ProvisionResult>()
    fake.provision.mockReturnValue(provisionGate.promise)

    act(() => result.current.submitCredentials('home-5g', 'secret'))
    act(() => result.current.submitCredentials('home-5g', 'secret2'))

    expect(fake.provision).toHaveBeenCalledTimes(1)
    expect(result.current.errorCategory).toBeUndefined()
    expect(result.current.busy).toBe(true)

    await act(async () => {
      provisionGate.resolve({ nextUrl: 'http://device.local' })
    })
    expect(result.current.lastUrl).toBe('http://device.local')
    expect(result.current.busy).toBe(false)
  })
})
