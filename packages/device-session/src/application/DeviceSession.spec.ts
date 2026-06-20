import 'fake-indexeddb/auto'
import { describe, expect, it, beforeEach, vi, type Mock } from 'vitest'
import { DeviceSession } from './DeviceSession'
import type { HardwareType, HardwareIdentity } from '../domain/types'
import type { DeviceSelector } from '../domain/selector'
import type { Transport } from '../domain/transport'
import { DeviceIdentityStore } from '../infrastructure/DeviceIdentityStore'

function makeMockTransport(device?: unknown): Transport & { port: unknown } {
  let mockPort = device ?? null
  return {
    name: 'mock-transport',
    get port() {
      return mockPort
    },
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    write: vi.fn(),
    read: vi.fn(),
  }
}

function makeMockSelector(): DeviceSelector<unknown> {
  return {
    type: 'serial' as HardwareType,
    request: vi.fn().mockRejectedValue(new Error('no default device')),
    getGranted: vi.fn().mockResolvedValue([]),
    getIdentity: vi.fn((_d) => ({ type: 'serial' })),
    watchDisconnect: vi.fn(),
    unwatchDisconnect: vi.fn(),
  }
}

describe('DeviceSession', () => {
  let mockSelector: DeviceSelector<unknown>
  let mockDevice: object
  let transports: Transport[]
  let lastConfig: Record<string, unknown> | undefined

  function createSession(storageKey = 'test') {
    transports = []
    lastConfig = undefined
    mockSelector = makeMockSelector()
    mockDevice = { id: 'device-1' }
    ;(mockSelector.request as Mock).mockResolvedValue(mockDevice)

    return new DeviceSession({
      storageKey,
      createSelector: () => mockSelector,
      createTransport: (_type, device, config) => {
        lastConfig = config
        const t = makeMockTransport(device)
        transports.push(t)
        return t
      },
    })
  }

  it('初始状态为 idle', () => {
    const session = createSession()
    expect(session.getStatus()).toBe('idle')
  })

  it('acquire 后状态为 ready', async () => {
    const session = createSession()
    const transport = await session.acquire('serial')

    expect(session.getStatus()).toBe('ready')
    expect(transport).toBe(transports[0])
    expect(transports[0].open).toHaveBeenCalledOnce()
  })

  it('acquire 调用 watchDisconnect', async () => {
    const session = createSession()
    await session.acquire('serial')

    expect(mockSelector.watchDisconnect).toHaveBeenCalledWith(mockDevice, expect.any(Function))
  })

  it('acquire 失败时回到 idle', async () => {
    const session = createSession()
    ;(mockSelector.request as Mock).mockRejectedValue(new Error('canceled'))

    await expect(session.acquire('serial')).rejects.toThrow('canceled')
    expect(session.getStatus()).toBe('idle')
  })

  it('重复 acquire 抛异常', async () => {
    const session = createSession()
    await session.acquire('serial')
    await expect(session.acquire('serial')).rejects.toThrow('already active')
  })

  it('release 后回到 idle', async () => {
    const session = createSession()
    await session.acquire('serial')
    await session.release()

    expect(session.getStatus()).toBe('idle')
    expect(transports[0].close).toHaveBeenCalledOnce()
  })

  it('release 调用 unwatchDisconnect', async () => {
    const session = createSession()
    await session.acquire('serial')
    await session.release()

    expect(mockSelector.unwatchDisconnect).toHaveBeenCalledWith(mockDevice, expect.any(Function))
  })

  it('reopen 用新配置重建传输', async () => {
    const session = createSession()
    await session.acquire('serial')

    await session.reopen({ baudRate: 9600 })

    expect(lastConfig).toEqual({ baudRate: 9600 })
    expect(transports).toHaveLength(2)
    expect(transports[0].close).toHaveBeenCalledOnce()
    expect(transports[1].open).toHaveBeenCalledOnce()
    expect(session.getStatus()).toBe('ready')
  })

  it('reopen 时没有活跃会话抛异常', async () => {
    const session = createSession()
    await expect(session.reopen({ baudRate: 9600 })).rejects.toThrow('No active session')
  })

  it('reopen 失败时回到 idle 并清理状态', async () => {
    const session = createSession()
    await session.acquire('serial')
    expect(session.getStatus()).toBe('ready')

    // 让新 transport 的 open 失败
    const failingTransport = {
      name: 'failing',
      open: vi.fn().mockRejectedValue(new Error('device busy')),
      close: vi.fn().mockResolvedValue(undefined),
      write: vi.fn(),
      read: vi.fn(),
    }
    ;(mockSelector.request as Mock).mockResolvedValue(mockDevice)

    const sessionWithFailing = new DeviceSession({
      storageKey: 'reopen-fail-test',
      createSelector: () => mockSelector,
      createTransport: (_type, _device, config) => {
        if (config && 'forceFail' in config) return failingTransport as unknown as Transport
        const t = makeMockTransport()
        transports.push(t)
        return t
      },
    })
    await sessionWithFailing.acquire('serial')
    expect(sessionWithFailing.getStatus()).toBe('ready')

    await expect(sessionWithFailing.reopen({ forceFail: true })).rejects.toThrow('device busy')
    expect(sessionWithFailing.getStatus()).toBe('idle')
    expect(sessionWithFailing.getTransport()).toBeNull()
  })

  it('acquire 失败时清理 disconnect watcher', async () => {
    const session = createSession()
    ;(mockSelector.request as Mock).mockResolvedValue(mockDevice)

    // 让 transport.open 失败
    const failSession = new DeviceSession({
      storageKey: 'acquire-fail-test',
      createSelector: () => mockSelector,
      createTransport: () => ({
        name: 'fail',
        open: vi.fn().mockRejectedValue(new Error('port busy')),
        close: vi.fn(),
        write: vi.fn(),
        read: vi.fn(),
      }),
    })

    await expect(failSession.acquire('serial')).rejects.toThrow('port busy')
    expect(failSession.getStatus()).toBe('idle')
    // unwatchDisconnect 应该被调用以清理 watcher
    expect(mockSelector.unwatchDisconnect).toHaveBeenCalledOnce()
  })

  it('断开事件触发状态变化', async () => {
    const session = createSession()

    let disconnectHandler: (() => void) | undefined
    ;(mockSelector.watchDisconnect as Mock).mockImplementation((_d, cb) => {
      disconnectHandler = cb
    })

    const onDisconnect = vi.fn()
    session.on('disconnect', onDisconnect)
    await session.acquire('serial')

    expect(session.getStatus()).toBe('ready')

    disconnectHandler!()
    expect(session.getStatus()).toBe('disconnected')
    expect(onDisconnect).toHaveBeenCalledOnce()
  })

  it('带 identity 时优先匹配已授权设备', async () => {
    const session = createSession()
    ;(mockSelector.getIdentity as Mock).mockImplementation((d) => ({
      type: 'serial',
      usbVendorId: d.usbVendorId,
      usbProductId: d.usbProductId,
    }))
    ;(mockSelector.getGranted as Mock).mockResolvedValue([
      { usbVendorId: 0x1234, usbProductId: 0x5678 },
      { usbVendorId: 0xaaaa, usbProductId: 0xbbbb },
    ])

    await session.acquire('serial', {
      type: 'serial',
      usbVendorId: 0x1234,
      usbProductId: 0x5678,
    })

    expect(mockSelector.request).not.toHaveBeenCalled()
  })

  it('带 identity 但无匹配时 fallback 到 request', async () => {
    const session = createSession()
    ;(mockSelector.getGranted as Mock).mockResolvedValue([
      { usbVendorId: 0xaaaa, usbProductId: 0xbbbb },
    ])

    await session.acquire('serial', {
      type: 'serial',
      usbVendorId: 0x1234,
      usbProductId: 0x5678,
    })

    expect(mockSelector.request).toHaveBeenCalledOnce()
  })

  it('clearIdentity 清空持久化记录', async () => {
    const store = new DeviceIdentityStore('clear-test')
    await store.save({ type: 'serial', usbVendorId: 1, usbProductId: 2 })
    expect(await store.load()).not.toBeNull()

    const session = new DeviceSession({ store })
    await session.clearIdentity()
    expect(await store.load()).toBeNull()

    await store.clear()
  })

  describe('tryRestore', () => {
    it('返回 false 当无存储的 identity', async () => {
      const store = new DeviceIdentityStore('restore-empty')
      const session = new DeviceSession({
        store,
        storageKey: 'restore-empty',
        createSelector: () => makeMockSelector(),
      })
      const result = await session.tryRestore()
      expect(result).toBe(false)
      expect(session.getStatus()).toBe('idle')

      await store.clear()
    })

    it('返回 false 当无匹配的已授权设备', async () => {
      const sel = makeMockSelector()
      ;(sel.getGranted as Mock).mockResolvedValue([])

      const store = new DeviceIdentityStore('restore-no-match')
      await store.save({ type: 'serial', usbVendorId: 0x1234, usbProductId: 0x5678 })

      const session = new DeviceSession({
        store,
        storageKey: 'restore-no-match',
        createSelector: () => sel,
        createTransport: () => makeMockTransport(),
      })
      const result = await session.tryRestore()
      expect(result).toBe(false)
      expect(session.getStatus()).toBe('idle')

      await store.clear()
    })

    it('返回 true 当匹配到已授权设备并建立连接', async () => {
      const device = { id: 'device-1', usbVendorId: 0x1234, usbProductId: 0x5678 }
      const sel = makeMockSelector()
      ;(sel.getGranted as Mock).mockResolvedValue([device])
      ;(sel.getIdentity as Mock).mockImplementation((d) => ({
        type: 'serial',
        usbVendorId: d.usbVendorId,
        usbProductId: d.usbProductId,
      }))

      const store = new DeviceIdentityStore('restore-match')
      await store.save({ type: 'serial', usbVendorId: 0x1234, usbProductId: 0x5678 })

      const session = new DeviceSession({
        store,
        storageKey: 'restore-match',
        createSelector: () => sel,
        createTransport: () => makeMockTransport(),
      })
      const result = await session.tryRestore()
      expect(result).toBe(true)
      expect(session.getStatus()).toBe('ready')
      expect(session.getTransport()).not.toBeNull()

      await store.clear()
    })

    it('返回 false 当会话已激活', async () => {
      const device = { id: 'device-1', usbVendorId: 0x1234, usbProductId: 0x5678 }
      const sel = makeMockSelector()
      ;(sel.request as Mock).mockResolvedValue(device)

      const store = new DeviceIdentityStore('restore-active')
      await store.save({ type: 'serial', usbVendorId: 0x1234, usbProductId: 0x5678 })

      const session = new DeviceSession({
        store,
        storageKey: 'restore-active',
        createSelector: () => sel,
        createTransport: () => makeMockTransport(),
      })
      await session.acquire('serial')
      expect(session.getStatus()).toBe('ready')

      const result = await session.tryRestore()
      expect(result).toBe(false)

      await store.clear()
    })
  })

  describe('多实例与事件', () => {
    it('多实例独立', async () => {
      const session1 = createSession('s1')
      const session2 = createSession('s2')

      await session1.acquire('serial')
      expect(session1.getStatus()).toBe('ready')
      expect(session2.getStatus()).toBe('idle')

      await session1.release()
      expect(session1.getStatus()).toBe('idle')
    })

    it('on("disconnect") 支持多订阅者', async () => {
      const session = createSession()

      let disconnectHandler: (() => void) | undefined
      ;(mockSelector.watchDisconnect as Mock).mockImplementation((_d, cb) => {
        disconnectHandler = cb
      })

      const h1 = vi.fn()
      const h2 = vi.fn()
      session.on('disconnect', h1)
      session.on('disconnect', h2)

      await session.acquire('serial')
      disconnectHandler!()

      expect(h1).toHaveBeenCalledOnce()
      expect(h2).toHaveBeenCalledOnce()
    })

    it('unsubscribe 后不再收到事件', async () => {
      const session = createSession()

      let disconnectHandler: (() => void) | undefined
      ;(mockSelector.watchDisconnect as Mock).mockImplementation((_d, cb) => {
        disconnectHandler = cb
      })

      const handler = vi.fn()
      const unsub = session.on('disconnect', handler)

      await session.acquire('serial')
      unsub()

      disconnectHandler!()
      expect(handler).not.toHaveBeenCalled()
    })
  })
})
