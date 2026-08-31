import { useEffect, useRef, useState } from 'react'
import type { ConsolePort } from '../../domain/types'
import { useKitI18n } from '../i18n/react'

export interface ConsoleViewProps {
  /** 进入控制台后返回的端口（readable 流）；由父组件调用 transport.enterConsole() 后传入 */
  port: ConsolePort
  /** 退出控制台回调（父组件负责调 transport.exitConsole() 并切回配网视图） */
  onExit: () => void
  /**
   * 复位设备回调（父组件/transport 层实现，负责 DTR/RTS 硬件复位）。
   * 本组件只负责按钮 UI + busy 态 + 错误展示，保持纯净可测；
   * 实际 esptool-js 调用在父组件接线时实现。
   */
  onReset?: () => Promise<void>
  /** 下载日志文件名（默认 'improvkit-logs.txt'） */
  downloadName?: string
}

/**
 * ConsoleView — 串口日志控制台：进入控制台后读原始字节流、按行累积展示、
 * 提供下载全部日志与退出入口。
 *
 * 读流生命周期：挂载时从 port.readable 取 reader 持续读取；卸载时 cancel
 * reader（释放底层端口锁，避免泄漏）。读流结束或出错（含 readable 为 null）
 * 统一显示「终端已断开」提示。
 *
 * 行分割：用 TextDecoder 解码字节为文本，累积 buffer 按 \n 切行；未换行的
 * 尾部暂存到下一 chunk（参考 esp-web-tools 的 LineBreakTransformer 思路，
 * 这里用简单 buffer 实现，避免引入额外 transformer 依赖）。
 */
export function ConsoleView({
  port,
  onExit,
  onReset,
  downloadName = 'improvkit-logs.txt',
}: ConsoleViewProps) {
  const { t } = useKitI18n()
  // 日志行：携带单调递增 id 作 React key（M2），文本为解码后的单行内容
  const [lines, setLines] = useState<Array<{ id: number; text: string }>>([])
  const [disconnected, setDisconnected] = useState(false)
  // 复位进行中：禁用复位按钮，避免重复触发硬件复位
  const [resetting, setResetting] = useState(false)
  // 复位失败提示（成功后清空，避免残留旧错误）
  const [resetError, setResetError] = useState<string | null>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  // 累积全部解码文本（含未换行尾部），供下载导出完整原始日志
  const fullTextRef = useRef('')
  // 行 id 计数器：用单调递增 id 作 key（M2），避免用数组索引——日志行只增不删，
  // 索引 key 在并发追加时可能复用导致 React 复用错行
  const lineIdRef = useRef(0)

  useEffect(() => {
    const readable = port.readable
    if (!readable) {
      setDisconnected(true)
      return
    }
    const reader = readable.getReader()
    readerRef.current = reader
    let cancelled = false
    let buffer = ''
    const decoder = new TextDecoder()

    async function pump() {
      try {
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          const text = decoder.decode(value, { stream: true })
          fullTextRef.current += text
          buffer += text
          const parts = buffer.split('\n')
          // 最后一段可能是不完整行，暂存到下一 chunk
          buffer = parts.pop() ?? ''
          if (parts.length > 0) {
            setLines((prev) => [
              ...prev,
              ...parts.map((text) => ({ id: ++lineIdRef.current, text })),
            ])
          }
        }
        // 流结束：冲刷残留的不完整行到行列表。注意 fullTextRef 已在每次 chunk
        // 解码时累积了含尾部的全部文本（M3），此处只补行列表，不再重复累加尾部，
        // 否则下载内容尾部会出现重复
        if (buffer.length > 0) {
          setLines((prev) => [...prev, { id: ++lineIdRef.current, text: buffer }])
        }
        if (!cancelled) setDisconnected(true)
      } catch {
        if (!cancelled) setDisconnected(true)
      }
    }
    void pump()

    return () => {
      cancelled = true
      readerRef.current = null
      // 卸载时取消读流，释放底层端口锁（cancel 幂等，重复调用安全）
      void reader.cancel().catch(() => {})
    }
  }, [port])

  // 新日志到达时自动滚动到底部，让用户始终看到最新输出
  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines])

  function handleDownload() {
    const blob = new Blob([fullTextRef.current], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = downloadName
    a.click()
    URL.revokeObjectURL(url)
  }

  // 复位设备：委托给父组件传入的 onReset（transport 层实现 DTR/RTS 硬件复位）。
  // 复位期间置 busy 禁用按钮；失败时展示错误提示，成功后清空旧错误。
  async function handleReset() {
    if (!onReset || resetting) return
    setResetting(true)
    setResetError(null)
    try {
      await onReset()
    } catch {
      setResetError(t('console_reset_failed'))
    } finally {
      setResetting(false)
    }
  }

  // 退出控制台：先释放 reader 锁再调 onExit。真实 UI 中 onExit 会调
  // transport.exitConsole → 重建 Improv 会话 → port.readable.getReader()；若
  // 本组件仍持有 reader 锁，getReader 会抛 TypeError，exitConsole 永远失败、
  // 用户困在控制台（C1）。cancel 让在途 read 干净结束，releaseLock 释放锁。
  function handleExit() {
    const reader = readerRef.current
    if (reader) {
      readerRef.current = null
      void reader.cancel().catch(() => {})
      reader.releaseLock()
    }
    onExit()
  }

  return (
    <div className="improv-console">
      <h2 className="improv-console__title">{t('console_title')}</h2>
      <div className="improv-console__log" data-testid="console-log" ref={logRef}>
        {lines.map((line) => (
          <div className="improv-console__line" key={line.id}>
            {line.text}
          </div>
        ))}
        {disconnected && (
          <div className="improv-console__disconnected" role="status">
            {t('console_disconnected')}
          </div>
        )}
      </div>
      <div className="improv-console__actions">
        <button
          type="button"
          className="improv-button improv-button--ghost"
          onClick={handleDownload}
        >
          {t('console_download')}
        </button>
        {onReset && (
          <button
            type="button"
            className="improv-button improv-button--ghost"
            onClick={handleReset}
            disabled={resetting}
          >
            {t('console_reset')}
          </button>
        )}
        <button type="button" className="improv-button improv-button--primary" onClick={handleExit}>
          {t('console_exit')}
        </button>
      </div>
      {resetError && (
        <div className="improv-console__error" role="alert">
          {resetError}
        </div>
      )}
    </div>
  )
}
