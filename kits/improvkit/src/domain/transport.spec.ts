import { describe, expectTypeOf, it } from 'vitest'
import type { DomainErrorCategory } from './errors'
import type { DeviceInfo, ImprovState, ProvisionResult, Ssid } from './types'
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
      provision(ssid: string, password: string): Promise<ProvisionResult>
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
})
