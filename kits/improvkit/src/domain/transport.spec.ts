import { describe, expectTypeOf, it } from 'vitest'
import type { DomainErrorCategory } from './errors'
import type { ConsolePort, DeviceInfo, ImprovState, ProvisionResult, Ssid } from './types'
import type { ErrorListener, IImprovTransport, StateListener } from './transport'

/**
 * IImprovTransport 接口契约（类型级一致性测试）。
 * 接口无运行时行为，本文件用 expectTypeOf 锁定接口形态，防止未来误改签名：
 * 任一侧漂移（增删成员、改参数/返回类型、只读性丢失）都会让断言失败。
 */
describe('IImprovTransport interface contract', () => {
  it('keeps the full interface shape with exact method signatures', () => {
    expectTypeOf<IImprovTransport>().toEqualTypeOf<{
      readonly state: ImprovState
      onStateChange(listener: StateListener): () => void
      onError(listener: ErrorListener): () => void
      connect(): Promise<DeviceInfo>
      scan(): Promise<Ssid[] | null>
      subscribeSSIDs(onChange: (ssids: Ssid[] | null) => void): () => Promise<void>
      provision(ssid: string, password: string): Promise<ProvisionResult>
      enterConsole(): Promise<ConsolePort>
      exitConsole(): Promise<void>
      resetDevice?(): Promise<void>
      close(): Promise<void>
    }>()
  })

  it('exposes state as a readonly ImprovState', () => {
    expectTypeOf<IImprovTransport['state']>().toEqualTypeOf<ImprovState>()
    const transport = {} as IImprovTransport
    // @ts-expect-error state 是只读属性，编译期禁止外部赋值
    transport.state = 'CONNECTING'
  })

  it('keeps listener callback signatures', () => {
    expectTypeOf<StateListener>().toEqualTypeOf<(state: ImprovState) => void>()
    expectTypeOf<ErrorListener>().toEqualTypeOf<(category: DomainErrorCategory) => void>()
  })

  it('keeps console-mode method signatures', () => {
    expectTypeOf<IImprovTransport['enterConsole']>().toEqualTypeOf<() => Promise<ConsolePort>>()
    expectTypeOf<IImprovTransport['exitConsole']>().toEqualTypeOf<() => Promise<void>>()
    // resetDevice 为可选成员（消费方可能未实现），签名固定为无参 Promise<void>
    expectTypeOf<IImprovTransport['resetDevice']>().toEqualTypeOf<
      (() => Promise<void>) | undefined
    >()
  })

  it('keeps ConsolePort as a clean structural port abstraction', () => {
    // 结构类型：readable / writable 可为 null，且不依赖 w3c SerialPort 具体类型
    expectTypeOf<ConsolePort>().toEqualTypeOf<{
      readonly readable: ReadableStream<Uint8Array> | null
      readonly writable: WritableStream<Uint8Array> | null
    }>()
  })
})
