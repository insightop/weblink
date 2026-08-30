import { describe, expect, it, vi } from 'vitest'
import { ImprovSerial } from 'improv-wifi-serial-sdk/dist/serial.js'
import type { DomainErrorCategory } from '../../domain/errors'
import { DomainProvisioningError } from '../../domain/errors'
import { FakeImprovPort, type FakeImprovPortScript } from '../fakes/fakeImprovDevice'
import {
  SerialTransport,
  type ImprovSessionLike,
  type SerialTransportDeps,
} from '../../infrastructure/serial/serialTransport'

/**
 * SerialTransport 集成测试（TDD 主战场）。
 *
 * 【重要声明】本文件 createSession 未 mock，走【真实】new ImprovSerial(port, console)：
 * requestPort 返回 FakeImprovPort 脚本假设备（`as unknown as SerialPort`），
 * openPort 为 no-op；从线协议帧应答到 SDK 解析、状态映射、错误 reject 全程真实。
 */

/** 组装依赖：沿用 FakeImprovPort 脚本 + 真实 ImprovSerial；端口可在用例间替换 */
function makeTransport(script: FakeImprovPortScript = {}) {
  let port = new FakeImprovPort(script)
  const deps: SerialTransportDeps = {
    requestPort: async () => port as unknown as SerialPort,
    openPort: async () => {},
    // 与默认实现相同的收口断言：SDK initialize 返回 Promise<info|undefined>，
    // 而本层接口约定 resolve 必有值（见 serialTransport.ts createDefaultSerialDeps 注释）
    createSession: (p) =>
      new ImprovSerial(p as unknown as SerialPort, console) as unknown as ImprovSessionLike,
  }
  const transport = new SerialTransport(deps)
  return {
    transport,
    getPort: () => port,
    replacePort(next: FakeImprovPort) {
      port = next
    },
  }
}

describe('SerialTransport integration with real ImprovSerial', () => {
  it('connects to a fake Improv device: reads scripted info and reaches READY', async () => {
    const { transport, getPort } = makeTransport()

    const info = await transport.connect()

    expect(transport.state).toBe('READY')
    // 与 fakeImprovDevice 内置 DEFAULT_INFO 一致
    expect(info).toEqual({
      name: 'improv-test-device',
      firmware: 'improv-test-firmware',
      version: '1.0.0',
      chipFamily: 'ESP32',
      osName: null,
      osVersion: null,
    })
    // 客户端确实向设备发起了 REQUEST_CURRENT_STATE 与 REQUEST_INFO
    const commands = getPort().receivedFrames.map((frame) => frame.data[0])
    expect(commands).toContain(2) // REQUEST_CURRENT_STATE
    expect(commands).toContain(3) // REQUEST_INFO
  })

  it('scan() returns the network list sorted by name (SDK sorts by lower-case name)', async () => {
    const { transport } = makeTransport({
      networks: [
        { name: 'zeta-net', rssi: -70, secured: false },
        { name: 'AlphaNet', rssi: -40, secured: true },
        { name: 'beta-net', rssi: -55, secured: true },
      ],
    })
    await transport.connect()

    const result = await transport.scan()

    expect(result).toEqual([
      { name: 'AlphaNet', rssi: -40, secured: true },
      { name: 'beta-net', rssi: -55, secured: true },
      { name: 'zeta-net', rssi: -70, secured: false },
    ])
  })

  it('provision() succeeds with the next URL and the session ends PROVISIONED', async () => {
    const { transport } = makeTransport({
      provisionOutcome: { kind: 'ok', nextUrl: 'https://example.com/setup' },
    })
    await transport.connect()

    const result = await transport.provision('MyWiFi', 'secret123')

    expect(result).toEqual({ nextUrl: 'https://example.com/setup' })
    // 设备先上报 PROVISIONING 再 PROVISIONED，最终状态收敛到 PROVISIONED
    expect(transport.state).toBe('PROVISIONED')
  })

  it('provision() failure rejects with UNABLE_TO_CONNECT and state ERROR', async () => {
    const { transport } = makeTransport({ provisionOutcome: { kind: 'fail' } })
    await transport.connect()

    const err = (await transport
      .provision('MyWiFi', 'wrong')
      .catch((e: unknown) => e)) as DomainProvisioningError

    expect(err).toBeInstanceOf(DomainProvisioningError)
    expect(err.category).toBe('UNABLE_TO_CONNECT')
    expect(transport.state).toBe('ERROR')
  })

  it('scan() returns null instead of rejecting when scan is unsupported', async () => {
    const { transport } = makeTransport({ scanSupported: false })
    await transport.connect()

    await expect(transport.scan()).resolves.toBeNull()
    // 降级不是错误：状态保持 READY
    expect(transport.state).toBe('READY')
  })

  it('reports DEVICE_WIFI_DISABLED when the device starts in STOPPED state', async () => {
    const { transport } = makeTransport({ initialState: 0x00 })
    const errors: DomainErrorCategory[] = []
    transport.onError((category) => errors.push(category))

    await transport.connect()

    expect(errors).toEqual(['DEVICE_WIFI_DISABLED'])
    // connect 成功仍以 READY 收尾；STOPPED 的持久信号是 onError（见单测注释）
    expect(transport.state).toBe('READY')
  })

  it('rejects NOT_IMPROV_DEVICE with state ERROR when the port is silent (non-Improv device)', async () => {
    const { transport } = makeTransport({ silent: true })

    const err = (await transport.connect().catch((e: unknown) => e)) as DomainProvisioningError

    expect(err).toBeInstanceOf(DomainProvisioningError)
    expect(err.category).toBe('NOT_IMPROV_DEVICE')
    expect(transport.state).toBe('ERROR')
    // 静默端口需等满 initialize 的 5s 超时才 reject（见 serialTransport.ts connect
    // 注释：放宽到 5000ms 降低真机误报），故本用例显式放宽测试超时
  }, 10000)

  it('reports DISCONNECTED and switches to ERROR when the device disconnects mid-session', async () => {
    const { transport, getPort } = makeTransport()
    const errors: DomainErrorCategory[] = []
    transport.onError((category) => errors.push(category))
    await transport.connect()

    getPort().triggerDisconnect()

    await vi.waitFor(() => expect(errors).toEqual(['DISCONNECTED']))
    expect(transport.state).toBe('ERROR')
  })

  it('close() is idempotent, stays silent, and a fresh connect works on a new port', async () => {
    const { transport, getPort, replacePort } = makeTransport()
    const errors: DomainErrorCategory[] = []
    transport.onError((category) => errors.push(category))
    await transport.connect()

    await transport.close()
    await transport.close()

    // close 触发的内部 disconnect 不得误报为 DISCONNECTED
    expect(errors).toEqual([])

    // 资源可复用：新端口实例上再次 connect 成功
    replacePort(new FakeImprovPort())
    await transport.connect()
    expect(transport.state).toBe('READY')
    expect(getPort().receivedFrames.some((frame) => frame.data[0] === 3)).toBe(true)
  })
})
