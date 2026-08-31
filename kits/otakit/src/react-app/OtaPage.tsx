import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from './i18n/useI18n'
import { useOtaSession } from './hooks/useOtaSession'
import { parseUrlParams } from '../core/url-params/parseUrlParams'
import { fetchFirmwareFromUrl, readFirmwareFile } from '../core/firmware/firmwareFetcher'
import { SerialSelect } from './components/SerialSelect'
import { FirmwareSelect } from './components/FirmwareSelect'
import { ProgressView } from './components/ProgressView'
import { LogPanel } from './components/LogPanel'
import './ota.css'

export function OtaPage() {
  const { t } = useI18n()
  const { state, start, reset } = useOtaSession()

  // 能力检测：Web Serial 需要安全上下文 + 浏览器支持。只在挂载时读取一次。
  // 注意：`serial` 可能被 stub 为 undefined，仅 `in` 判断会误判为支持，故用 `!= null`。
  const [serialSupported] = useState(
    () => typeof navigator !== 'undefined' && 'serial' in navigator && navigator.serial != null,
  )
  const [secureContext] = useState(() => typeof window !== 'undefined' && window.isSecureContext)

  // URL 参数预填（slaveId/baudrate/firmwareUrl/auto/bypassFirmwareStart）
  const paramsRef = useRef(parseUrlParams(window.location.search))

  const [port, setPort] = useState<SerialPort | null>(null)
  const [firmwareUrl, setFirmwareUrl] = useState<string>(() => paramsRef.current.firmwareUrl ?? '')
  const [hexData, setHexData] = useState<string>('')
  const [logs, setLogs] = useState<string[]>([])

  const appendLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev, msg])
  }, [])

  // Web Serial 规范：必须先 `await port.open({ baudRate })` 才能访问
  // port.writable/port.readable，否则二者均为 null。用 ref 记录已打开的 port，
  // 避免同一 port 重复 open（重复 open 会抛 InvalidStateError）。
  const portOpenedRef = useRef<SerialPort | null>(null)

  const handleStart = useCallback(async () => {
    if (!port || !hexData) return
    const params = paramsRef.current
    const baudRate = params.baudrate ?? 115200
    // 首次（或换 port 后）先打开串口，把用户选择的 baudrate 应用到物理链路。
    if (portOpenedRef.current !== port) {
      await port.open({ baudRate })
      portOpenedRef.current = port
    }
    // transact：把一帧写入串口并读取响应帧（Modbus RTU / XCP 帧交换）
    const transact = async (frame: Uint8Array, timeoutMs = 1000): Promise<Uint8Array> => {
      if (!port) throw new Error('no port')
      const writer = port.writable?.getWriter()
      if (writer) {
        try {
          await writer.write(frame)
        } finally {
          writer.releaseLock()
        }
      }
      const reader = port.readable?.getReader()
      if (!reader) return new Uint8Array(0)

      // 读侧真实超时：设备静默（read 永不 resolve）时须在 timeoutMs 后终止，否则
      // transact 挂死 → session.connect() 永不返回 → UI 永久停在 connecting。
      // 关键点：真实 Web Serial 的 reader.read() 不会因"外部 AbortController.abort()"
      // 而自动中断，故需用 AbortController + Promise.race 竞速兜底，abort 时 reject 结束
      // pending read；同时调用 reader.cancel() 释放真实底层的 pending read。
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      const chunks: number[] = []

      const abortGate = () =>
        new Promise<{ value?: Uint8Array; done: boolean }>((_, reject) => {
          if (controller.signal.aborted) {
            reject(new DOMException('read aborted', 'AbortError'))
            return
          }
          controller.signal.addEventListener(
            'abort',
            () => reject(new DOMException('read aborted', 'AbortError')),
            { once: true },
          )
        })

      try {
        while (!controller.signal.aborted) {
          const { value, done } = await Promise.race([reader.read(), abortGate()])
          if (done) break
          if (value) chunks.push(...Array.from(value))
          // 已知响应帧长：address(1) + function(1) + 长度(1) + data + checksum(2)
          if (chunks.length >= 3 && chunks[2] > 0) {
            const total = 3 + chunks[2] + 2
            if (chunks.length >= total) break
          }
        }
      } catch (e) {
        // abort 触发的读中断视为超时，返回已收到的字节；其余错误向上抛。
        if (!controller.signal.aborted) throw e
        // 让真实 Web Serial 释放 pending read（fake reader 无 cancel 时跳过）
        reader.cancel?.()
      } finally {
        clearTimeout(timer)
        reader.releaseLock()
      }
      return new Uint8Array(chunks)
    }
    appendLog(`start slaveId=${params.slaveId ?? 1} baudrate=${baudRate}`)
    await start({
      transact,
      slaveId: params.slaveId ?? 1,
      baudrate: baudRate,
      hexData,
      bypassFirmwareStart: params.bypassFirmwareStart,
    })
  }, [port, hexData, start, appendLog])

  // auto 模式：挂载后若 URL 提供了 firmwareUrl，自动下载 hex（避免用户手动点「下载固件」）。
  // firmwareUrl 来自 URL params，初始后不再变化；仅在 auto=1 时预取，手动模式由用户点「下载固件」。
  useEffect(() => {
    const params = paramsRef.current
    if (!params.auto) return
    const url = params.firmwareUrl
    if (!url || hexData !== '') return
    let cancelled = false
    void fetchFirmwareFromUrl(url)
      .then((data) => {
        if (!cancelled) setHexData(data)
      })
      .catch(() => {
        if (!cancelled) appendLog('auto fetch firmware failed')
      })
    return () => {
      cancelled = true
    }
    // 仅挂载时执行一次（firmwareUrl/auto 来自 URL params，之后不变）
  }, [])

  // auto=1 时的自动开始：选中串口、hex 已就绪且会话空闲时自动触发刷写（只自动一次）
  const autoStartedRef = useRef(false)
  useEffect(() => {
    const params = paramsRef.current
    if (!params.auto) return
    if (state.active) return
    if (!port || !hexData || autoStartedRef.current) return
    autoStartedRef.current = true
    void handleStart()
  }, [port, hexData, state.active, handleStart])

  if (!serialSupported) {
    return <div className="ota-kit">{t('ota.unsupported')}</div>
  }
  if (!secureContext) {
    return <div className="ota-kit">{t('ota.insecure')}</div>
  }

  return (
    <div className="ota-kit">
      <h1>{t('ota.title')}</h1>

      <SerialSelect onSelect={setPort} />
      <FirmwareSelect
        initialUrl={firmwareUrl}
        onUrlChange={setFirmwareUrl}
        onFile={async (f) => setHexData(await readFirmwareFile(f))}
        onUrlFetch={async (url) => setHexData(await fetchFirmwareFromUrl(url))}
      />

      <div className="ota-field">
        <button
          type="button"
          className="ota-btn ota-btn-primary"
          onClick={() => void handleStart()}
          disabled={!port || !hexData || state.active}
        >
          {t('ota.start')}
        </button>
        <button type="button" className="ota-btn" onClick={reset}>
          {t('ota.clearLog')}
        </button>
      </div>

      <ProgressView state={state} />
      <LogPanel lines={logs} onClear={() => setLogs([])} />
    </div>
  )
}
