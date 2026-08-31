import { useCallback, useRef, useState } from 'react'
import { OtaSession } from '../../core/session/otaSession'
import { OtaError } from '../../core/session/otaSession.errors'
import type { ProgramProgress } from '../../core/session/otaSession.types'

export type OtaStage = 'idle' | 'connecting' | 'programming' | 'resetting' | 'done' | 'failed'

export interface OtaState {
  active: boolean
  stage: OtaStage
  percent: number
  detail?: string
  error?: string
  /** OtaError 的动态上下文（如擦除/写入失败时的地址），供 UI 追加展示。 */
  errorDetail?: string
}

export interface StartOptions {
  transact: (frame: Uint8Array, timeoutMs?: number) => Promise<Uint8Array>
  slaveId: number
  baudrate: number
  hexData: string
  bypassFirmwareStart?: number
}

/**
 * useOtaSession — OTA 会话编排 hook。
 *
 * start 编排一条 connect → program → reset 的流水线，把 `OtaSession` 的
 * 异步结果收敛为一个可渲染状态机（idle→connecting→programming→resetting→done，
 * 任一环节抛错进 failed 并记录 error）。state 同步镜像 stateRef 供并发锁判断：
 * active 期间再次 start 直接 return，避免重复会话（与 improvkit 的 busyRef 同类）。
 * reset 把状态复位到 idle，供重试。
 */
export function useOtaSession() {
  const [state, setState] = useState<OtaState>({ active: false, stage: 'idle', percent: 0 })
  const stateRef = useRef(state)
  stateRef.current = state

  const set = (v: Partial<OtaState>) => setState((p) => ({ ...p, ...v }))

  const start = useCallback(async (opts: StartOptions) => {
    if (stateRef.current.active) return
    set({ active: true, stage: 'connecting', percent: 0 })
    const session = new OtaSession(opts.transact, opts.slaveId, opts.baudrate, {
      bypassFirmwareStart: opts.bypassFirmwareStart,
    })
    try {
      await session.connect()
      set({ stage: 'programming', percent: 0 })
      await session.program(opts.hexData, (p: ProgramProgress) => {
        if (p.percent != null) set({ percent: p.percent, detail: p.phase })
      })
      set({ stage: 'resetting', percent: 100 })
      await session.reset()
      set({ stage: 'done', percent: 100 })
    } catch (e) {
      if (e instanceof OtaError) {
        set({ stage: 'failed', error: e.message, errorDetail: e.detail })
      } else {
        set({ stage: 'failed', error: e instanceof Error ? e.message : String(e) })
      }
    } finally {
      session.close()
      set({ active: false })
    }
  }, [])

  const reset = useCallback(() => {
    setState({ active: false, stage: 'idle', percent: 0 })
  }, [])

  return { state, start, reset }
}
