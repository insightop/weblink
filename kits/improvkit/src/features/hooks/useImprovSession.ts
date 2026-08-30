import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DomainProvisioningError, type DomainErrorCategory } from '../../domain/errors'
import type { ConsolePort, DeviceInfo, ImprovState, Ssid } from '../../domain/types'
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
  /** 网络列表：undefined=尚未就绪（宽限期等待中）；null=设备不支持扫描；数组=列表 */
  networks?: Ssid[] | null
  /** networks === null 的语义化别名（设备不支持扫描） */
  scanUnavailable: boolean
  /** 首扫宽限期已过（SCAN_GRACE_PERIOD）仍无任何扫描结果：UI 据此显示"未发现网络"空态 */
  scanGraceExpired: boolean
  /** 最近一次错误类别：动作失败或传输异步错误（物理断连等） */
  errorCategory?: DomainErrorCategory
  /** 配网成功后的设备跳转 URL */
  lastUrl?: string
  /** 控制台端口：进入控制台后持有；undefined = 不在控制台（页面据此渲染 ConsoleView 而非配网表单） */
  consolePort?: ConsolePort
  /** connect / refreshScan / submitCredentials 进行中 */
  busy: boolean
  connect: () => void
  refreshScan: () => void
  submitCredentials: (ssid: string, password: string) => void
  changeWifi: () => void
  /** 进入控制台模式（可选：页面未接线控制台时无需提供；hook 恒返回） */
  enterConsole?: () => void
  /** 退出控制台模式（可选，同上） */
  exitConsole?: () => void
  /** 复位设备并回到配网视图（可选，同上） */
  resetConsole?: () => void
  /** 真实硬件复位设备（可选：transport 未实现时不存在；复位后设备重启、会话失效） */
  resetDevice?: () => Promise<void>
  /** 复位后提示用户重新连接（真实硬件复位成功置位；重新 connect 时清除） */
  resetNotice: boolean
  reset: () => void
}

/**
 * 首扫宽限期（毫秒）：进入 READY 后等待设备返回首个扫描结果的窗口。
 * 参考 esp-web-tools；取 12s 覆盖 SDK subscribeSSIDs 约 4 轮扫描（每轮 3s），
 * 期间返回的空列表不立即算作"未发现网络"（刚启动/刚烧录设备可能首扫为空）。
 */
export const SCAN_GRACE_PERIOD = 12000

/**
 * useImprovSession — 会话编排 hook（本 kit 的核心状态层）。
 *
 * 职责：在 React 侧镜像传输状态机；编排 connect → 持续扫描 → 配网 → 成功/重试
 * 的会话流程；把传输的 Promise reject 与 onError 双通道统一收敛为 errorCategory；
 * 保证动作的异步异常绝不逃逸（不产生 unhandled rejection）。
 *
 * 扫描模型（D13）：用**持续扫描**取代一次性 scan。每次进入 READY（connect 成功
 * 或 changeWifi 回来）时订阅 transport.subscribeSSIDs，离开 READY（进入
 * PROVISIONING/PROVISIONED/ERROR 表单语境之外的连接态）或 reset / 卸载时取消，
 * 对齐 esp-web-tools 的 `_syncScanning`。`refreshScan` 退化为「重新订阅持续扫描」：
 * SDK 的 subscribeSSIDs 一经调用立即首扫，重订阅即等价于一次手动刷新，简单且不
 * 新增一次性 scan 的并发路径（transport.ts 契约：subscribeSSIDs 与 scan 不应同时
 * 占用同一会话 RPC）。
 *
 * 传输生命周期：mount 时创建并订阅；reset / 卸载时退订 + close（close 幂等，
 * StrictMode 双挂载安全）；reset 之后再次动作会惰性重建全新传输。
 *
 * 控制台模式（D16）：enterConsole 关闭 Improv 会话、取回裸端口供日志读取，页面以
 * consolePort 存在与否渲染 ConsoleView 而非配网表单；进入是"临时查看日志"，保留
 * deviceInfo/networks 等配网语境，exitConsole 成功即恢复 READY 可配网。控制台模式下
 * 配网操作（connect/refreshScan/submitCredentials）被 hook 侧拒绝（transport 契约：
 * 恢复前不得调用）；reset / 卸载时若在控制台，先 exitConsole 再 close，保证会话一致。
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
  const [scanGraceExpired, setScanGraceExpired] = useState(false)
  const [errorCategory, setErrorCategory] = useState<DomainErrorCategory>()
  const [lastUrl, setLastUrl] = useState<string>()
  const [consolePort, setConsolePort] = useState<ConsolePort>()
  const [busy, setBusy] = useState(false)
  // 复位后提示重新连接：真实硬件复位成功置位，重新 connect 时清除
  const [resetNotice, setResetNotice] = useState(false)

  // 持续扫描订阅函数本体：返回取消函数；内部持有 transport 引用，不参与 React
  // 状态依赖，便于在 effect 中按代际安全地挂载/拆卸。transport 的 subscribeSSIDs
  // 返回 `() => Promise<void>`，close 时 await 等待在途扫描结束（transport.ts 契约）
  const scanControllerRef = useRef<{ cancel: () => Promise<void> } | null>(null)
  // networks 的同步镜像：grace 计时器据此判断「截止时是否已有任何扫描结果」，
  // 避免已返回结果后计时应答仍置位空态（见首扫宽限期 effect）
  const networksRef = useRef<Ssid[] | null | undefined>(undefined)
  // consolePort 的同步镜像：供回调（connect/refreshScan/submitCredentials 的
  // 控制台屏蔽、closeTransport 的退出控制台）在闭包内同步读取，避免依赖 state
  // 造成陈旧闭包或额外重渲染
  const consolePortRef = useRef<ConsolePort | undefined>(undefined)

  /** 订阅持续扫描（仅在 READY 语境调用，由 state effect 保证）；返回取消函数 */
  const startSsidScan = useCallback(
    (transport: IImprovTransport, gen: number): (() => Promise<void>) | null => {
      const cancel = transport.subscribeSSIDs((ssids) => {
        if (generationRef.current !== gen) return
        networksRef.current = ssids
        setNetworks(ssids)
        // 收到任一非 null 结果即认为扫描已有结果（含空列表：那是"确实没网络"而非
        // "未扫描"）；宽限空态只在「宽限期结束仍无任何回调结果」时出现，此处复位
        if (ssids !== null) {
          setScanGraceExpired(false)
        }
      })
      // 记录取消控制器：closeTransport / 离开 READY 时统一停表
      const controller = { cancel }
      scanControllerRef.current = controller
      return () => controller.cancel()
    },
    [],
  )

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

  // 停止当前持续扫描：离开 READY / reset / 卸载共用。作废扫描控制器引用
  const stopSsidScan = useCallback((): void => {
    const controller = scanControllerRef.current
    scanControllerRef.current = null
    if (controller) {
      // await 在途扫描结束：transport 层面已保证取消幂等
      void controller.cancel().catch(() => {})
    }
  }, [])

  // 关闭并释放当前传输：先退订（避免 close 引发的状态变化污染会话语境），再幂等
  // close——close 幂等是 domain 契约，卸载/repeated reset 都安全
  const closeTransport = useCallback((): void => {
    // 会话代际 +1：作废在途动作（reset / 卸载共用本路径，旧异步的迟到
    // setState 一律被代际比对丢弃）
    generationRef.current += 1
    // 先停持续扫描：与 close 协同（transport 会在 close 中再兜底取消一次，幂等）
    stopSsidScan()
    unsubscribeRef.current()
    unsubscribeRef.current = () => {}
    const transport = transportRef.current
    transportRef.current = null
    if (transport) {
      // 若在控制台模式：先退出控制台恢复 Improv 会话，再 close——保证 transport
      // 会话状态一致（close 假定处于正常会话语境；ConsoleView 卸载会 cancel 读流，
      // 此处兜底恢复会话）。两者都 fire-and-forget 吞错防逃逸，但按序同步发起：
      // exitConsole 先于 close 调用，满足"先退出再关闭"的语义；close 幂等，
      // 失败不影响会话释放
      if (consolePortRef.current) {
        void transport.exitConsole().catch(() => {})
      }
      void transport.close().catch(() => {})
    }
  }, [stopSsidScan])

  // mount 建立会话、卸载释放；StrictMode 双挂载由幂等清理保障：清理 = 退订一次 +
  // close（幂等），第二次 effect 挂到全新传输上
  useEffect(() => {
    ensureTransport()
    return closeTransport
  }, [ensureTransport, closeTransport])

  // 持续扫描与状态机同步：进入 READY 即订阅、离开 READY（进入连接/配网/成功态）
  // 即取消。依赖 state（每次状态变更重跑 effect），代际在 effect 内捕获以保证
  // reset 后旧扫描的迟到回调被丢弃。cleanup 统一调 stopSsidScan（而非捕获某个
  // 快照），避免 refreshScan 重订阅后旧引用失效导致扫描泄漏
  useEffect(() => {
    const transport = transportRef.current
    if (!transport) return
    if (state === 'READY') {
      const gen = generationRef.current
      // 启动时同步首扫：SDK subscribeSSIDs 一经调用立即扫描一轮
      startSsidScan(transport, gen)
      return () => stopSsidScan()
    }
    // 非 READY：停止扫描（离开表单）
    stopSsidScan()
    return undefined
  }, [state, startSsidScan, stopSsidScan])

  // 首扫宽限期计时：进入 READY 时开始计时；若宽限期结束仍无有效网络（从未收到
  // 结果=undefined，或收到的是空列表=[]），置位"未发现网络"空态。null 表示
  // 设备不支持扫描，不计入（走 scanUnavailable 的专属 UI）。回调已收到非空
  // 列表则宽限期永不置位。计时只依赖 [state]，不在扫描回调时重跑——避免每次
  // 结果都重置宽限期窗口
  useEffect(() => {
    if (state !== 'READY') {
      setScanGraceExpired(false)
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      // 截止时检查同步镜像：无结果或结果为空 → 置位"未发现网络"
      if (!cancelled) {
        const current = networksRef.current
        const noNetworks = current === undefined || (Array.isArray(current) && current.length === 0)
        if (noNetworks) setScanGraceExpired(true)
      }
    }, SCAN_GRACE_PERIOD)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [state])

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

  const connect = useCallback((): void => {
    if (busyRef.current) return
    // 控制台模式下 Improv 会话不可用（transport 契约：恢复前不得调用配网操作），
    // 直接拒绝——页面已按 consolePort 屏蔽配网表单，此处为契约兜底
    if (consolePortRef.current) return
    const transport = ensureTransport()
    busyRef.current = true
    setErrorCategory(undefined)
    setBusy(true)
    // 重新连接即清除复位提示（用户已响应"重新连接"）
    setResetNotice(false)
    const gen = generationRef.current
    void (async () => {
      try {
        const info = await transport.connect()
        // 等待期间会话被 reset / 卸载：代际不匹配，丢弃迟到结果
        if (generationRef.current !== gen) return
        setDeviceInfo(info)
        // connect 成功进入 READY 时自动订阅持续扫描由 state effect 驱动；若设备
        // 已配网（PROVISIONED）则不进入 READY effect，不会开启扫描（已配网设备
        // 无需扫描，且扫描会干扰其状态）
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
  }, [ensureTransport, recordError])

  // 手动刷新：退化为「重新订阅持续扫描」（SDK 调用即立即首扫）。与持续扫描本身
  // 不冲突：只是把当前订阅取消后再订阅一次，等价于触发一轮立即扫描
  const refreshScan = useCallback((): void => {
    if (busyRef.current) return
    // 控制台模式下无扫描可刷新（同 connect 的契约兜底）
    if (consolePortRef.current) return
    // 惰性建立会话（若已 reset 重建）：后续以 transportRef.current 引用读取
    ensureTransport()
    busyRef.current = true
    setErrorCategory(undefined)
    setBusy(true)
    const gen = generationRef.current
    // 显式重新订阅：取消旧订阅（await 在途扫描结束）后立即开启新订阅（首扫一次）。
    // 这样即便当前不在 READY，也能借 READY 语义刷新——但 transport 会拒绝非 READY
    // 订阅前检查；这里只在 READY 才真正重订阅，非 READY 退化为 no-op
    if (transportRef.current?.state === 'READY') {
      void (async () => {
        try {
          // 停当前扫描（若在）再重订阅，得到一轮立即扫描
          const old = scanControllerRef.current
          if (old) {
            scanControllerRef.current = null
            await old.cancel().catch(() => {})
          }
          if (generationRef.current === gen) {
            startSsidScan(transportRef.current!, gen)
          }
        } catch (cause) {
          // 与 connect/submitCredentials 对齐：重订阅期间 await 取消时若会话被
          // reset/断连，transport.subscribeSSIDs 会同步抛「需活跃会话」异常——
          // 必须就地收敛为错误类别，否则会逃逸成 unhandled rejection（F2）
          if (generationRef.current === gen) recordError(cause)
        } finally {
          if (generationRef.current === gen) {
            busyRef.current = false
            setBusy(false)
          }
        }
      })()
    } else {
      // 非 READY：无扫描可刷新，直接复位
      busyRef.current = false
      setBusy(false)
    }
  }, [ensureTransport, startSsidScan, recordError])

  const submitCredentials = useCallback(
    (ssid: string, password: string): void => {
      if (busyRef.current) return
      // 控制台模式下不得下发配网凭据（同 connect 的契约兜底）
      if (consolePortRef.current) return
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
    // 其余状态不臆造迁移，保持与传输状态机一致。state→READY 的 effect 会自动
    // 重新订阅持续扫描
    if (state !== 'PROVISIONED') return
    setLastUrl(undefined)
    setState('READY')
  }, [state])

  // 进入控制台模式：关闭 Improv 会话、取回裸端口供日志读取（transport 契约）。
  // 进入是"临时查看日志"——保留 deviceInfo/networks 等配网语境，退出后能恢复
  // 配网视图；页面以 consolePort 存在与否决定渲染 ConsoleView 而非配网表单。
  // 与 connect 同构：busyRef 重入守卫 + 代际比对丢弃 reset 后的迟到结果
  const enterConsole = useCallback((): void => {
    if (busyRef.current) return
    // 已在控制台：幂等拒绝（transport 契约 enterConsole 幂等，但 hook 侧无需重复进入）
    if (consolePortRef.current) return
    const transport = ensureTransport()
    busyRef.current = true
    setErrorCategory(undefined)
    setBusy(true)
    const gen = generationRef.current
    void (async () => {
      try {
        const port = await transport.enterConsole()
        if (generationRef.current !== gen) return
        consolePortRef.current = port
        setConsolePort(port)
      } catch (cause) {
        if (generationRef.current === gen) recordError(cause)
      } finally {
        if (generationRef.current === gen) {
          busyRef.current = false
          setBusy(false)
        }
      }
    })()
  }, [ensureTransport, recordError])

  // 退出控制台模式：重新打开端口并恢复 Improv 会话（transport 契约，成功即 READY）。
  // 成功后清空 consolePort，页面据此回到配网视图；state→READY 的 effect 会自动
  // 重新订阅持续扫描
  const exitConsole = useCallback((): void => {
    if (busyRef.current) return
    // 不在控制台：幂等拒绝（transport 契约 exitConsole 幂等，但 hook 侧无需重复退出）
    if (!consolePortRef.current) return
    const transport = transportRef.current
    if (!transport) return
    busyRef.current = true
    setErrorCategory(undefined)
    setBusy(true)
    const gen = generationRef.current
    void (async () => {
      try {
        await transport.exitConsole()
        if (generationRef.current !== gen) return
        consolePortRef.current = undefined
        setConsolePort(undefined)
      } catch (cause) {
        if (generationRef.current === gen) recordError(cause)
      } finally {
        if (generationRef.current === gen) {
          busyRef.current = false
          setBusy(false)
        }
      }
    })()
  }, [recordError])

  // 复位设备并回到配网视图：语义上等价于退出控制台（exitConsole 成功即恢复 READY
  // 可配网），故直接复用；页面把 ConsoleView 的 onReset 接到本方法。
  // 【有意别名】resetConsole 是 exitConsole 的薄别名，非冗余：页面在 transport 未
  // 实现真实硬件复位（resetDevice）时回退到本方法，语义是「软复位=退出控制台」；
  // 保留别名使调用点意图清晰，避免直接调 exitConsole 造成「复位」语义被掩盖
  const resetConsole = useCallback((): void => {
    exitConsole()
  }, [exitConsole])

  // 真实硬件复位设备：透传 transport.resetDevice（若存在）。复位会重启设备、
  // 使 Improv 会话失效，成功后清空控制台端口回到配网入口视图（transport 已清理
  // 会话状态并置 IDLE）。与 enterConsole 同构：busyRef 重入守卫 + 代际比对丢弃
  // reset 后的迟到结果；transport 未实现 resetDevice 时本方法不存在（页面回退
  // resetConsole）。返回的 promise 在复位完成/失败时 settle，供 UI 层 await 真实
  // 复位（I1：busy 态与错误路径真实，而非 fire-and-forget）
  const resetDevice = useCallback((): Promise<void> => {
    // 重入守卫 / transport 未实现复位：返回已 resolve 的 no-op promise，保持
    // 返回类型恒为 Promise<void>（调用方 handleReset 直接 return 即可，无需判空）
    if (busyRef.current) return Promise.resolve()
    const transport = transportRef.current
    if (!transport?.resetDevice) return Promise.resolve()
    busyRef.current = true
    setErrorCategory(undefined)
    setBusy(true)
    const gen = generationRef.current
    return (async () => {
      try {
        await transport.resetDevice!()
        if (generationRef.current !== gen) return
        consolePortRef.current = undefined
        setConsolePort(undefined)
        // 复位重启设备后 Improv 会话失效：提示用户重新连接
        setResetNotice(true)
      } catch (cause) {
        if (generationRef.current === gen) recordError(cause)
        // 复位失败：把错误向上抛给调用方（UI 的 handleReset 据此展示失败提示），
        // 同时保证不产生 unhandled rejection——调用方必须 catch
        throw cause
      } finally {
        if (generationRef.current === gen) {
          busyRef.current = false
          setBusy(false)
        }
      }
    })()
  }, [recordError])

  const reset = useCallback((): void => {
    closeTransport()
    // 同步复位 busy 镜像：即使有在途动作（其 finally 已被代际作废），
    // reset 之后新一轮动作也能立即发起
    busyRef.current = false
    // 同步镜像一并复位：否则重连进入 READY 时宽限期计时会读到上一会话残留的
    // networksRef 而误判"已有结果"
    networksRef.current = undefined
    // 控制台镜像一并复位：closeTransport 已按 consolePortRef 决定是否先 exitConsole，
    // 此处清空引用与状态，避免 reset 后残留"在控制台"的陈旧标记
    consolePortRef.current = undefined
    setState('IDLE')
    setDeviceInfo(undefined)
    setNetworks(undefined)
    setScanGraceExpired(false)
    setErrorCategory(undefined)
    setLastUrl(undefined)
    setConsolePort(undefined)
    setBusy(false)
    // 复位提示一并清除：reset 是全新会话起点，不残留上一会话的"重新连接"提示
    setResetNotice(false)
  }, [closeTransport])

  return useMemo(
    () => ({
      state,
      deviceInfo,
      networks,
      scanUnavailable: networks === null,
      scanGraceExpired,
      errorCategory,
      lastUrl,
      consolePort,
      busy,
      resetNotice,
      connect,
      refreshScan,
      submitCredentials,
      changeWifi,
      enterConsole,
      exitConsole,
      resetConsole,
      resetDevice,
      reset,
    }),
    [
      state,
      deviceInfo,
      networks,
      scanGraceExpired,
      errorCategory,
      lastUrl,
      consolePort,
      busy,
      resetNotice,
      connect,
      refreshScan,
      submitCredentials,
      changeWifi,
      enterConsole,
      exitConsole,
      resetConsole,
      resetDevice,
      reset,
    ],
  )
}
