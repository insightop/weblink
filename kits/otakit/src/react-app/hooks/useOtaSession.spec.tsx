import { beforeEach, describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { ProgramProgress } from '../../core/session/otaSession.types'
import { OtaError } from '../../core/session/otaSession.errors'
import { useOtaSession, type StartOptions } from './useOtaSession'

// 打桩 OtaSession 类：hook 内部 new OtaSession(...) 只做状态机编排，
// connect/program/reset 都由实例 mock 控制，避免真实 XCP/libopenblt 握手。
const { OtaSession } = vi.hoisted(() => ({ OtaSession: vi.fn() }))

vi.mock('../../core/session/otaSession', () => ({ OtaSession }))

// 可控 promise：在 act 内显式放行，精确观察中间态（improvkit 同款辅助）
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

const TRANSPORT = async () => new Uint8Array([0x01, 0x6d, 0x02, 0xff, 0x00, 0x00, 0x00])

const START_OPTS: StartOptions = {
  transact: TRANSPORT,
  slaveId: 1,
  baudrate: 115200,
  hexData: ':020000040000FA\n:00000001FF\n',
}

interface SessionLike {
  connect: ReturnType<typeof vi.fn>
  program: ReturnType<typeof vi.fn>
  reset: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
}

/** 生成一个行为全可编排的假 OtaSession 实例 */
function createSession(): SessionLike {
  return {
    connect: vi.fn(async () => {}),
    program: vi.fn(async () => {}),
    reset: vi.fn(async () => {}),
    close: vi.fn(() => {}),
  }
}

/**
 * 让 OtaSession mock 在 hook 内 `new OtaSession(...)` 时返回给定实例。
 * 必须用可构造的普通 function（箭头函数不可作构造函数，`new` 会抛
 * "not a constructor"）。结合 mockReturnValue/promise 编排异步阶段。
 */
function configureSession(instance: SessionLike): void {
  OtaSession.mockImplementation(function () {
    return instance
  })
}

describe('useOtaSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('初始状态：idle、未激活、percent 为 0、无 error', () => {
    const { result } = renderHook(() => useOtaSession())
    expect(result.current.state).toEqual({ active: false, stage: 'idle', percent: 0 })
  })

  it('成功流程推进状态机 idle→connecting→programming→resetting→done，percent 更新，active 生命周期正确', async () => {
    const session = createSession()
    const connectGate = deferred<void>()
    const programGate = deferred<void>()
    const resetGate = deferred<void>()
    session.connect.mockReturnValue(connectGate.promise)
    session.program.mockImplementation((_hex: string, cb?: (p: ProgramProgress) => void) => {
      cb?.({ phase: 'writing', percent: 55 })
      return programGate.promise
    })
    session.reset.mockReturnValue(resetGate.promise)
    configureSession(session)

    const { result } = renderHook(() => useOtaSession())
    expect(result.current.state.stage).toBe('idle')

    let started!: Promise<void>
    act(() => {
      started = result.current.start(START_OPTS)
    })
    expect(result.current.state.stage).toBe('connecting')
    expect(result.current.state.active).toBe(true)
    expect(OtaSession).toHaveBeenCalledWith(TRANSPORT, 1, 115200, {
      bypassFirmwareStart: undefined,
    })

    await act(async () => {
      connectGate.resolve()
    })
    expect(result.current.state.stage).toBe('programming')
    // program 进度回调已落地 percent
    expect(result.current.state.percent).toBe(55)

    await act(async () => {
      programGate.resolve()
    })
    expect(result.current.state.stage).toBe('resetting')
    expect(result.current.state.percent).toBe(100)

    await act(async () => {
      resetGate.resolve()
    })
    expect(result.current.state.stage).toBe('done')
    expect(result.current.state.percent).toBe(100)
    expect(result.current.state.active).toBe(false)

    expect(session.close).toHaveBeenCalledTimes(1)
    await started
  })

  it('connect 抛错：stage 变为 failed 并记录 error，active 复位，close 被调用', async () => {
    const session = createSession()
    session.connect.mockRejectedValue(new Error('timeout'))
    configureSession(session)

    const { result } = renderHook(() => useOtaSession())
    await act(async () => {
      await result.current.start(START_OPTS)
    })
    expect(result.current.state.stage).toBe('failed')
    expect(result.current.state.error).toBe('timeout')
    expect(result.current.state.active).toBe(false)
    expect(session.close).toHaveBeenCalledTimes(1)
  })

  it('program 抛错：stage 变为 failed（失败路径统一收敛）', async () => {
    const session = createSession()
    session.program.mockRejectedValue(new Error('erase failed'))
    configureSession(session)

    const { result } = renderHook(() => useOtaSession())
    await act(async () => {
      await result.current.start(START_OPTS)
    })
    expect(result.current.state.stage).toBe('failed')
    expect(result.current.state.error).toBe('erase failed')
    expect(result.current.state.active).toBe(false)
  })

  it('OtaError 抛错：error 记录 code，errorDetail 记录动态上下文', async () => {
    const session = createSession()
    session.connect.mockRejectedValue(new OtaError('erase.failed', '0x8000000'))
    configureSession(session)

    const { result } = renderHook(() => useOtaSession())
    await act(async () => {
      await result.current.start(START_OPTS)
    })
    expect(result.current.state.stage).toBe('failed')
    expect(result.current.state.error).toBe('erase.failed')
    expect(result.current.state.errorDetail).toBe('0x8000000')
    expect(result.current.state.active).toBe(false)
  })

  it('start 期间再次 start：并发锁直接返回，不创建第二个会话', async () => {
    const session = createSession()
    const connectGate = deferred<void>()
    session.connect.mockReturnValue(connectGate.promise)
    session.program.mockResolvedValue(undefined)
    session.reset.mockResolvedValue(undefined)
    configureSession(session)

    const { result } = renderHook(() => useOtaSession())
    let first!: Promise<void>
    act(() => {
      first = result.current.start(START_OPTS)
    })
    expect(OtaSession).toHaveBeenCalledTimes(1)
    expect(result.current.state.stage).toBe('connecting')

    // active 期间再次 start：直接返回，不构造新会话、不推进状态
    await act(async () => {
      await result.current.start(START_OPTS)
      connectGate.resolve()
    })
    expect(OtaSession).toHaveBeenCalledTimes(1)
    expect(session.connect).toHaveBeenCalledTimes(1)
    expect(result.current.state.stage).toBe('done')
    await first
  })

  it('reset：状态回到 idle', () => {
    const { result } = renderHook(() => useOtaSession())
    act(() => {
      result.current.start(START_OPTS)
    })
    act(() => {
      result.current.reset()
    })
    expect(result.current.state).toEqual({ active: false, stage: 'idle', percent: 0 })
  })
})
