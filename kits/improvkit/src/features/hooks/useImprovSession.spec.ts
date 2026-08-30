import { StrictMode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DomainProvisioningError } from '../../domain/errors'
import type { DomainErrorCategory } from '../../domain/errors'
import type { DeviceInfo, ImprovState, ProvisionResult, Ssid } from '../../domain/types'
import type { ErrorListener, IImprovTransport, StateListener } from '../../domain/transport'
import { useImprovSession } from './useImprovSession'

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
 * 订阅不重放（onStateChange/onError 只记录监听，不立即回放当前值），
 * 与 domain/transport.ts 契约一致。
 */
class FakeTransport implements IImprovTransport {
  state: ImprovState = 'IDLE'
  readonly connect = vi.fn<() => Promise<DeviceInfo>>()
  readonly scan = vi.fn<() => Promise<Ssid[] | null>>()
  readonly provision = vi.fn<(ssid: string, password: string) => Promise<ProvisionResult>>()
  // close 默认返回已 resolve 的 promise：hook 在 reset/卸载时总会调用它
  readonly close = vi.fn(async () => {})

  private readonly stateListeners = new Set<StateListener>()
  private readonly errorListeners = new Set<ErrorListener>()

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

  /** 测试辅助：当前挂着的订阅数（state + error） */
  listenerCount(): number {
    return this.stateListeners.size + this.errorListeners.size
  }

  /** 测试辅助：模拟真实传输的成功 connect（resolve 时已进入 READY 并携带设备信息） */
  scriptConnectSuccess(): void {
    this.connect.mockImplementation(async () => {
      this.emitState('READY')
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

describe('useImprovSession', () => {
  it('初始状态：IDLE、未扫描、无设备信息/错误/URL、不忙，且挂载即订阅', () => {
    const { result, current } = setup()
    expect(result.current.state).toBe('IDLE')
    expect(result.current.deviceInfo).toBeUndefined()
    expect(result.current.networks).toBeUndefined()
    expect(result.current.scanUnavailable).toBe(false)
    expect(result.current.errorCategory).toBeUndefined()
    expect(result.current.lastUrl).toBeUndefined()
    expect(result.current.busy).toBe(false)
    expect(current().listenerCount()).toBe(2) // onStateChange + onError 各一
  })

  it('挂载创建传输；订阅不重放，初始状态来自对 transport.state 的显式读取', () => {
    const fake = new FakeTransport()
    fake.state = 'READY' // 模拟订阅时刻已存在的会话状态
    const { result } = renderHook(() => useImprovSession({ createTransport: () => fake }))
    expect(result.current.state).toBe('READY')
    // 此后状态推进完全由事件驱动
    act(() => fake.emitState('CONNECTING'))
    expect(result.current.state).toBe('CONNECTING')
  })

  it('connect 成功：记录设备信息并自动扫一次网络，期间 busy 保持 true', async () => {
    const { result, current } = setup()
    const fake = current()
    const connectGate = deferred<DeviceInfo>()
    const scanGate = deferred<Ssid[] | null>()
    fake.connect.mockImplementation(async () => {
      fake.emitState('READY')
      return connectGate.promise
    })
    fake.scan.mockReturnValue(scanGate.promise)

    act(() => result.current.connect())
    expect(result.current.busy).toBe(true)
    expect(fake.connect).toHaveBeenCalledTimes(1)

    // 放行 connect：进入 READY 并自动首扫（scan 未完成，busy 保持 true）
    await act(async () => {
      connectGate.resolve(DEVICE_INFO)
    })
    expect(result.current.state).toBe('READY')
    expect(result.current.deviceInfo).toEqual(DEVICE_INFO)
    expect(fake.scan).toHaveBeenCalledTimes(1)
    expect(result.current.busy).toBe(true)

    // 放行扫描：网络列表落地，busy 复位
    await act(async () => {
      scanGate.resolve(NETWORKS)
    })
    expect(result.current.networks).toEqual(NETWORKS)
    expect(result.current.scanUnavailable).toBe(false)
    expect(result.current.busy).toBe(false)
  })

  it('connect 失败（领域错误）：按类别记录，不触发自动扫描', async () => {
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
    expect(fake.scan).not.toHaveBeenCalled()
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
    expect(result.current.state).toBe('IDLE') // 传输未改变状态
    expect(fake.scan).not.toHaveBeenCalled()
    expect(result.current.busy).toBe(false)
  })

  it('refreshScan：手动触发扫描，成功后落地网络列表', async () => {
    const fake = new FakeTransport()
    fake.scan.mockResolvedValue(NETWORKS)
    const { result } = renderHook(() => useImprovSession({ createTransport: () => fake }))

    await act(async () => {
      result.current.refreshScan()
    })
    expect(fake.scan).toHaveBeenCalledTimes(1)
    expect(result.current.networks).toEqual(NETWORKS)
    expect(result.current.scanUnavailable).toBe(false)
    expect(result.current.busy).toBe(false)
  })

  it('refreshScan：设备不支持扫描（null）→ scanUnavailable 降级，不算错误', async () => {
    const fake = new FakeTransport()
    fake.scan.mockResolvedValue(null)
    const { result } = renderHook(() => useImprovSession({ createTransport: () => fake }))

    await act(async () => {
      result.current.refreshScan()
    })
    expect(result.current.networks).toBeNull()
    expect(result.current.scanUnavailable).toBe(true)
    expect(result.current.errorCategory).toBeUndefined()
  })

  it('refreshScan 失败：按类别记录错误', async () => {
    const fake = new FakeTransport()
    fake.scan.mockRejectedValue(new DomainProvisioningError('TIMEOUT'))
    const { result } = renderHook(() => useImprovSession({ createTransport: () => fake }))

    await act(async () => {
      result.current.refreshScan()
    })
    expect(result.current.errorCategory).toBe('TIMEOUT')
    expect(result.current.busy).toBe(false)
  })

  it('submitCredentials 成功：记录 nextUrl，状态由传输事件驱动为 PROVISIONED', async () => {
    const { result, current } = setup()
    const fake = current()
    fake.scriptConnectSuccess()
    fake.scan.mockResolvedValue(NETWORKS)
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

  it('submitCredentials 失败：记录错误类别，保留表单语境（deviceInfo/networks）并可重试', async () => {
    const { result, current } = setup()
    const fake = current()
    fake.scriptConnectSuccess()
    fake.scan.mockResolvedValue(NETWORKS)
    fake.provision.mockImplementation(async () => {
      fake.emitState('ERROR')
      throw new DomainProvisioningError('UNABLE_TO_CONNECT')
    })

    await act(async () => {
      result.current.connect()
    })
    await act(async () => {
      result.current.submitCredentials('home-5g', 'wrong-password')
    })
    expect(result.current.state).toBe('ERROR')
    expect(result.current.errorCategory).toBe('UNABLE_TO_CONNECT')
    // 重试语境：设备信息与网络列表不被清除
    expect(result.current.deviceInfo).toEqual(DEVICE_INFO)
    expect(result.current.networks).toEqual(NETWORKS)

    // 直接重试成功
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

  it('onError 异步错误：记录错误类别（物理断连等非操作绑定错误）', () => {
    const { result, current } = setup()
    act(() => current().emitError('DISCONNECTED'))
    expect(result.current.errorCategory).toBe('DISCONNECTED')
  })

  it('changeWifi：PROVISIONED 后清空 lastUrl 回到 READY，不关闭会话', async () => {
    const { result, current } = setup()
    const fake = current()
    fake.scriptConnectSuccess()
    fake.scan.mockResolvedValue(NETWORKS)
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
    act(() => result.current.changeWifi())
    expect(result.current.state).toBe('READY')
    expect(result.current.lastUrl).toBeUndefined()
    expect(result.current.deviceInfo).toEqual(DEVICE_INFO) // 设备信息保留
    expect(result.current.networks).toEqual(NETWORKS) // 表单语境保留
    expect(fake.close).not.toHaveBeenCalled() // 不关会话
  })

  it('changeWifi：非 PROVISIONED 状态不臆造迁移', () => {
    const { result, current } = setup()
    act(() => result.current.changeWifi())
    expect(result.current.state).toBe('IDLE')
    act(() => current().emitState('READY'))
    act(() => result.current.changeWifi())
    expect(result.current.state).toBe('READY') // 保持 READY，不产生其他迁移
  })

  it('reset：关闭并退订会话，全部状态回到初始', async () => {
    const { result, current } = setup()
    const fake = current()
    fake.scriptConnectSuccess()
    fake.scan.mockResolvedValue(NETWORKS)
    await act(async () => {
      result.current.connect()
    })

    act(() => result.current.reset())
    expect(result.current.state).toBe('IDLE')
    expect(result.current.deviceInfo).toBeUndefined()
    expect(result.current.networks).toBeUndefined()
    expect(result.current.errorCategory).toBeUndefined()
    expect(result.current.lastUrl).toBeUndefined()
    expect(result.current.busy).toBe(false)
    expect(fake.close).toHaveBeenCalledTimes(1)
    expect(fake.listenerCount()).toBe(0) // 已退订
  })

  it('reset 后可重新连接：惰性重建全新传输并重走流程', async () => {
    // 按调用次序预制传输：第一次连接失败，第二次（reset 后重建）连接成功
    const factories: Array<() => FakeTransport> = [
      () => {
        const fake = new FakeTransport()
        fake.connect.mockRejectedValue(new DomainProvisioningError('TIMEOUT'))
        return fake
      },
      () => {
        const fake = new FakeTransport()
        fake.scriptConnectSuccess()
        fake.scan.mockResolvedValue(NETWORKS)
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

    // reset 后再次 connect：创建新传输（fakes[1]）并成功
    await act(async () => {
      result.current.connect()
    })
    expect(fakes).toHaveLength(2)
    expect(result.current.state).toBe('READY')
    expect(result.current.deviceInfo).toEqual(DEVICE_INFO)
    expect(result.current.networks).toEqual(NETWORKS)
    expect(fakes[0].connect).toHaveBeenCalledTimes(1) // 旧传输未被复用
  })

  it('reset 后卸载：close 只调用一次（清理幂等）', () => {
    const { result, current, unmount } = setup()
    const fake = current()
    act(() => result.current.reset())
    expect(fake.close).toHaveBeenCalledTimes(1)
    unmount()
    expect(fake.close).toHaveBeenCalledTimes(1) // reset 已释放，卸载不再重复 close
  })

  it('卸载清理：close + 退订，之后传输事件不再唤醒 hook', () => {
    const { current, unmount } = setup()
    const fake = current()
    expect(fake.listenerCount()).toBe(2)
    unmount()
    expect(fake.close).toHaveBeenCalledTimes(1)
    expect(fake.listenerCount()).toBe(0)
    // 退订生效：卸载后 emit 不回调也不抛错
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
    expect(fakes).toHaveLength(2) // 双挂载：两个作用域各建一个传输
    expect(fakes[0].close).toHaveBeenCalledTimes(1) // 第一次作用域已清理
    expect(fakes[0].listenerCount()).toBe(0)
    expect(fakes[1].close).not.toHaveBeenCalled() // 新传输存活
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
      fake.scan.mockRejectedValue(new DomainProvisioningError('TIMEOUT'))
      fake.provision.mockRejectedValue(new Error('net down'))
      const { result } = renderHook(() => useImprovSession({ createTransport: () => fake }))

      await act(async () => {
        result.current.connect()
      })
      await act(async () => {
        result.current.refreshScan()
      })
      await act(async () => {
        result.current.submitCredentials('ssid', 'password')
      })
      act(() => result.current.reset()) // reset 触发的 close 拒绝同样不逃逸
      expect(fake.close).toHaveBeenCalledTimes(1)

      // 排空微任务队列后再断言：确保潜在未处理拒绝已被 Node 分发
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(unhandled).toEqual([])
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })
})

describe('useImprovSession 并发防护与异步失效', () => {
  it('connect 进行中再次 connect：重入被拒，第二次不产生传输调用且无虚假错误', async () => {
    const { result, current } = setup()
    const fake = current()
    const connectGate = deferred<DeviceInfo>()
    fake.connect.mockReturnValue(connectGate.promise)
    fake.scan.mockResolvedValue(NETWORKS)

    act(() => result.current.connect())
    act(() => result.current.connect()) // busy 重入：应被忽略

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
    act(() => result.current.reset()) // 作废在途 connect 并复位 busy
    expect(result.current.busy).toBe(false)

    // 旧 connect 在 reset 之后才 reject：代际已作废，错误不得落地
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
    act(() => result.current.submitCredentials('home-5g', 'secret2')) // busy 重入：应被忽略

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
