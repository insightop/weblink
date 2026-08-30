import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DomainProvisioningError, type DomainErrorCategory } from '../../domain/errors'
import type { DeviceInfo, ImprovState, Ssid } from '../../domain/types'
import type { IImprovTransport } from '../../domain/transport'
import { SerialTransport } from '../../infrastructure/serial/serialTransport'

export interface UseImprovSessionOptions {
  /** 传输工厂：默认 Web Serial；测试注入 fake 编排行为 */
  createTransport?: () => IImprovTransport
}

export interface UseImprovSessionResult {
  /** 会话状态：由传输状态机驱动（changeWifi 是唯一的本地编排迁移） */
  state: ImprovState
  /** 设备信息：connect 成功时写入 */
  deviceInfo?: DeviceInfo
  /** 网络列表：undefined=未扫描；null=设备不支持扫描（降级手动输入）；数组=列表 */
  networks?: Ssid[] | null
  /** networks === null 的语义化别名（设备不支持扫描） */
  scanUnavailable: boolean
  /** 最近一次错误类别：动作失败或传输异步错误（物理断连等） */
  errorCategory?: DomainErrorCategory
  /** 配网成功后的设备跳转 URL */
  lastUrl?: string
  /** connect / refreshScan / submitCredentials 进行中 */
  busy: boolean
  connect: () => void
  refreshScan: () => void
  submitCredentials: (ssid: string, password: string) => void
  changeWifi: () => void
  reset: () => void
}

/**
 * useImprovSession — 会话编排 hook（本 kit 的核心状态层）。
 *
 * 职责：在 React 侧镜像传输状态机；编排 connect → 自动首扫 → 配网 → 成功
 * /重试的会话流程；把传输的 Promise reject 与 onError 双通道统一收敛为
 * errorCategory；保证动作的异步异常绝不逃逸（不产生 unhandled rejection）。
 *
 * 传输生命周期：mount 时创建并订阅；reset / 卸载时退订 + close（close 幂等，
 * StrictMode 双挂载安全）；reset 之后再次动作会惰性重建全新传输。
 */
export function useImprovSession(options: UseImprovSessionOptions = {}): UseImprovSessionResult {
  // 传输工厂在首次渲染固定（useState 惰性初始化）：会话生命周期内不随父组件每次传入的
  // 新函数变化——换工厂等同换会话，应走 reset + 重新挂载
  const [createTransport] = useState<() => IImprovTransport>(
    () => options.createTransport ?? (() => new SerialTransport()),
  )

  /** 当前传输与一次性退订函数：reset / 卸载后置空 */
  const transportRef = useRef<IImprovTransport | null>(null)
  const unsubscribeRef = useRef<() => void>(() => {})

  // 会话代际：reset / 卸载（closeTransport）时自增，作废所有在途异步动作。
  // 每个动作开始捕获当前代际，setState 前比对——旧会话的迟到结果一律丢弃，
  // 防止 reset 后旧 connect/scan/provision 的结果污染新会话
  const generationRef = useRef(0)
  // busy 的同步镜像：动作入口做重入守卫（防同一动作并发调用），async 边界后复位
  const busyRef = useRef(false)

  const [state, setState] = useState<ImprovState>('IDLE')
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>()
  const [networks, setNetworks] = useState<Ssid[] | null>()
  const [errorCategory, setErrorCategory] = useState<DomainErrorCategory>()
  const [lastUrl, setLastUrl] = useState<string>()
  const [busy, setBusy] = useState(false)

  const handleStateChange = useCallback((next: ImprovState): void => {
    setState(next)
  }, [])

  const handleError = useCallback((category: DomainErrorCategory): void => {
    // onError 仅承载非操作绑定的异步传输错误（物理断连等），直接记录类别
    setErrorCategory(category)
  }, [])

  // 建立会话：mount 时经下方 effect 急切创建并订阅；reset 之后由首次动作
  // （ensureTransport 被再次调用）惰性重建。订阅不重放当前值（transport.ts
  // 契约），必须先订阅再读 state，否则订阅前发生的事件会永久丢失
  const ensureTransport = useCallback((): IImprovTransport => {
    const existing = transportRef.current
    if (existing) return existing
    const transport = createTransport()
    transportRef.current = transport
    const unsubscribeState = transport.onStateChange(handleStateChange)
    const unsubscribeError = transport.onError(handleError)
    unsubscribeRef.current = () => {
      unsubscribeState()
      unsubscribeError()
    }
    setState(transport.state)
    return transport
  }, [createTransport, handleStateChange, handleError])

  // 关闭并释放当前传输：先退订（避免 close 引发的状态变化污染会话语境），再幂等
  // close——close 幂等是 domain 契约，卸载/repeated reset 都安全
  const closeTransport = useCallback((): void => {
    // 会话代际 +1：作废在途动作（reset / 卸载共用本路径，旧异步的迟到
    // setState 一律被代际比对丢弃）
    generationRef.current += 1
    unsubscribeRef.current()
    unsubscribeRef.current = () => {}
    const transport = transportRef.current
    transportRef.current = null
    if (transport) {
      // close 失败（端口已被系统回收等）不影响会话释放语义，吞掉防逃逸
      void transport.close().catch(() => {})
    }
  }, [])

  // mount 建立会话、卸载释放；StrictMode 双挂载由幂等清理保障：清理 = 退订一次 +
  // close（幂等），第二次 effect 挂到全新传输上
  useEffect(() => {
    ensureTransport()
    return closeTransport
  }, [ensureTransport, closeTransport])

  // 记录动作失败：领域错误按类别记录（REQUEST_CANCELLED 静默——UI 对其不展示），
  // 非领域异常（宿主环境意外错误）统一兜底为 UNKNOWN_ERROR
  const recordError = useCallback((cause: unknown): void => {
    if (cause instanceof DomainProvisioningError) {
      if (cause.category === 'REQUEST_CANCELLED') return
      setErrorCategory(cause.category)
      return
    }
    setErrorCategory('UNKNOWN_ERROR')
  }, [])

  // 扫描并记结果（失败仅记类别、不抛出）：connect 自动首扫与 refreshScan 共用。
  // gen 为发起动作时捕获的会话代际：扫描期间会话可能已 reset / 卸载，结果丢弃
  const runScan = useCallback(
    async (transport: IImprovTransport, gen: number): Promise<void> => {
      try {
        // scan 返回 null = 设备不支持扫描（降级手动输入 SSID），不是错误
        const next = await transport.scan()
        if (generationRef.current === gen) setNetworks(next)
      } catch (cause) {
        if (generationRef.current === gen) recordError(cause)
      }
    },
    [recordError],
  )

  const connect = useCallback((): void => {
    if (busyRef.current) return
    const transport = ensureTransport()
    busyRef.current = true
    setErrorCategory(undefined)
    setBusy(true)
    const gen = generationRef.current
    void (async () => {
      try {
        const info = await transport.connect()
        // 等待期间会话被 reset / 卸载：代际不匹配，丢弃迟到结果
        if (generationRef.current !== gen) return
        setDeviceInfo(info)
        // connect 成功即进入 READY：按 spec 自动扫一次网络（首扫失败同样走错误记录）。
        // 但设备已配网（PROVISIONED）时无需扫描——扫描会干扰已配网设备，且其状态
        // 已由传输反映为成功态，直接呈现成功页即可
        if (transport.state === 'READY') {
          await runScan(transport, gen)
        }
      } catch (cause) {
        if (generationRef.current === gen) recordError(cause)
      } finally {
        // 仅在代际未变时复位 busy：否则可能清除 reset 之后新一轮动作的 busy
        if (generationRef.current === gen) {
          busyRef.current = false
          setBusy(false)
        }
      }
    })()
  }, [ensureTransport, runScan, recordError])

  const refreshScan = useCallback((): void => {
    if (busyRef.current) return
    const transport = ensureTransport()
    busyRef.current = true
    setErrorCategory(undefined)
    setBusy(true)
    const gen = generationRef.current
    void runScan(transport, gen).finally(() => {
      if (generationRef.current === gen) {
        busyRef.current = false
        setBusy(false)
      }
    })
  }, [ensureTransport, runScan])

  const submitCredentials = useCallback(
    (ssid: string, password: string): void => {
      if (busyRef.current) return
      const transport = ensureTransport()
      busyRef.current = true
      setErrorCategory(undefined)
      setBusy(true)
      const gen = generationRef.current
      void (async () => {
        try {
          const result = await transport.provision(ssid, password)
          if (generationRef.current !== gen) return
          setLastUrl(result.nextUrl)
        } catch (cause) {
          // 配网失败保留表单语境（deviceInfo / networks 不清除），允许直接重试
          if (generationRef.current === gen) recordError(cause)
        } finally {
          if (generationRef.current === gen) {
            busyRef.current = false
            setBusy(false)
          }
        }
      })()
    },
    [ensureTransport, recordError],
  )

  const changeWifi = useCallback((): void => {
    // 仅 PROVISIONED → READY 这一迁移由本 hook 编排（传输没有对应方法）；
    // 其余状态不臆造迁移，保持与传输状态机一致
    if (state !== 'PROVISIONED') return
    setLastUrl(undefined)
    setState('READY')
  }, [state])

  const reset = useCallback((): void => {
    closeTransport()
    // 同步复位 busy 镜像：即使有在途动作（其 finally 已被代际作废），
    // reset 之后新一轮动作也能立即发起
    busyRef.current = false
    setState('IDLE')
    setDeviceInfo(undefined)
    setNetworks(undefined)
    setErrorCategory(undefined)
    setLastUrl(undefined)
    setBusy(false)
  }, [closeTransport])

  return useMemo(
    () => ({
      state,
      deviceInfo,
      networks,
      scanUnavailable: networks === null,
      errorCategory,
      lastUrl,
      busy,
      connect,
      refreshScan,
      submitCredentials,
      changeWifi,
      reset,
    }),
    [
      state,
      deviceInfo,
      networks,
      errorCategory,
      lastUrl,
      busy,
      connect,
      refreshScan,
      submitCredentials,
      changeWifi,
      reset,
    ],
  )
}
