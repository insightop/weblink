import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ConsolePort } from '../../domain/types'
import { I18nProvider } from '../i18n/react'
import { ConsoleView } from './ConsoleView'

/**
 * 构造可控串口端口：保留底层 controller 供测试 enqueue/close，
 * 并暴露底层 source 的 cancel 间谍（reader.cancel 会触发它，用于断言卸载取消读流）。
 */
function makePort() {
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const cancelSpy = vi.fn()
  const readable = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
    },
    cancel(reason) {
      cancelSpy(reason)
    },
  })
  return {
    port: { readable, writable: null } satisfies ConsolePort,
    enqueue: (text: string) => controller.enqueue(new TextEncoder().encode(text)),
    close: () => controller.close(),
    cancelSpy,
  }
}

function renderConsole(props: {
  port: ConsolePort
  onExit?: () => void
  onReset?: () => Promise<void>
  downloadName?: string
}) {
  const onExit = props.onExit ?? vi.fn()
  const onReset = props.onReset ?? vi.fn()
  const utils = render(
    <I18nProvider locale="en-US">
      <ConsoleView
        port={props.port}
        onExit={onExit}
        onReset={onReset}
        downloadName={props.downloadName}
      />
    </I18nProvider>,
  )
  return { onExit, onReset, ...utils }
}

afterEach(() => cleanup())

describe('ConsoleView', () => {
  it('挂载后读取串口流并按行累积渲染日志', async () => {
    const p = makePort()
    renderConsole({ port: p.port })
    p.enqueue('line1\nline2\n')
    expect(await screen.findByText('line1')).toBeTruthy()
    expect(screen.getByText('line2')).toBeTruthy()
  })

  it('跨 chunk 的文本按行缓冲累积（未换行部分暂存到下一 chunk）', async () => {
    const p = makePort()
    renderConsole({ port: p.port })
    p.enqueue('hel')
    p.enqueue('lo\nworld\n')
    expect(await screen.findByText('hello')).toBeTruthy()
    expect(screen.getByText('world')).toBeTruthy()
  })

  it('新日志到达时自动滚动到底部', async () => {
    const p = makePort()
    renderConsole({ port: p.port })
    const container = screen.getByTestId('console-log')
    Object.defineProperty(container, 'scrollHeight', { value: 500, configurable: true })
    container.scrollTop = 0
    p.enqueue('line1\n')
    await waitFor(() => expect(container.scrollTop).toBe(500))
  })

  it('下载按钮：把累积日志导出为 .txt 文件', async () => {
    const p = makePort()
    renderConsole({ port: p.port, downloadName: 'my-logs.txt' })
    p.enqueue('hello\nworld\n')
    await screen.findByText('hello')

    const createObjectURL = vi.fn((_blob: Blob) => 'blob:fake')
    const revokeObjectURL = vi.fn()
    URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL
    URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    fireEvent.click(screen.getByRole('button', { name: 'Download Logs' }))

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    const blob = createObjectURL.mock.calls[0][0] as Blob
    expect(blob.type).toBe('text/plain')
    expect(clickSpy).toHaveBeenCalledTimes(1)
    const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement
    expect(anchor.download).toBe('my-logs.txt')
    expect(anchor.href).toBe('blob:fake')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake')
  })

  it('下载内容不重复累积未换行尾部（M3）', async () => {
    const p = makePort()
    renderConsole({ port: p.port, downloadName: 'logs.txt' })
    // 未换行的尾部：'tail' 先作为 chunk 文本进入 fullText，流结束时又作为残留
    // buffer 冲刷一次——若双重累积，下载内容尾部会出现重复
    p.enqueue('line1\n')
    p.enqueue('tail')
    await screen.findByText('line1')
    p.close()
    await screen.findByText('Terminal disconnected')

    const createObjectURL = vi.fn((_blob: Blob) => 'blob:fake')
    URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    fireEvent.click(screen.getByRole('button', { name: 'Download Logs' }))

    const blob = createObjectURL.mock.calls[0][0] as Blob
    const text = await blob.text()
    // 尾部 'tail' 只出现一次，不因流结束冲刷而重复
    expect(text).toBe('line1\ntail')
  })

  it('读流结束（close）时显示终端已断开提示', async () => {
    const p = makePort()
    renderConsole({ port: p.port })
    p.enqueue('line1\n')
    await screen.findByText('line1')
    expect(screen.queryByText('Terminal disconnected')).toBeNull()
    p.close()
    expect(await screen.findByText('Terminal disconnected')).toBeTruthy()
  })

  it('port.readable 为 null 时显示终端已断开提示', () => {
    renderConsole({ port: { readable: null, writable: null } })
    expect(screen.getByText('Terminal disconnected')).toBeTruthy()
  })

  it('卸载时取消读流（reader.cancel）', async () => {
    const p = makePort()
    const { unmount } = renderConsole({ port: p.port })
    p.enqueue('line1\n')
    await screen.findByText('line1')
    expect(p.cancelSpy).not.toHaveBeenCalled()
    unmount()
    expect(p.cancelSpy).toHaveBeenCalledTimes(1)
  })

  it('退出按钮调用 onExit', async () => {
    const p = makePort()
    const { onExit } = renderConsole({ port: p.port })
    fireEvent.click(screen.getByRole('button', { name: 'Exit' }))
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('退出前释放 reader 锁，使 exitConsole 能重新 getReader（C1）', async () => {
    const p = makePort()
    // onExit 在真实 UI 中会调 transport.exitConsole → 重建 Improv 会话 →
    // port.readable.getReader()；若 reader 仍持有锁会抛 TypeError，用户困在控制台。
    // 断言 onExit 被调用时流已解锁（reader 已释放）
    let lockedAtExit: boolean | null = null
    const onExit = () => {
      lockedAtExit = p.port.readable!.locked
    }
    renderConsole({ port: p.port, onExit })
    // 挂载后 ConsoleView 已取 reader，流被锁
    await waitFor(() => expect(p.port.readable!.locked).toBe(true))

    fireEvent.click(screen.getByRole('button', { name: 'Exit' }))

    // onExit 触发时 reader 已释放：流不再被锁，exitConsole 可重新 getReader
    expect(lockedAtExit).toBe(false)
    expect(p.port.readable!.locked).toBe(false)
  })

  it('渲染复位设备按钮', () => {
    const p = makePort()
    renderConsole({ port: p.port })
    expect(screen.getByRole('button', { name: 'Reset Device' })).toBeTruthy()
  })

  it('点击复位按钮触发 onReset', async () => {
    const p = makePort()
    const { onReset } = renderConsole({
      port: p.port,
      onReset: vi.fn().mockResolvedValue(undefined),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reset Device' }))
    await waitFor(() => expect(onReset).toHaveBeenCalledTimes(1))
  })

  it('复位进行中（onReset 未 resolve）时按钮禁用，完成后恢复', async () => {
    const p = makePort()
    let resolveReset!: () => void
    const onReset = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveReset = resolve
        }),
    )
    renderConsole({ port: p.port, onReset })
    const button = screen.getByRole('button', { name: 'Reset Device' }) as HTMLButtonElement
    fireEvent.click(button)
    // busy 期间禁用
    await waitFor(() => expect(button.disabled).toBe(true))
    resolveReset()
    // 完成后恢复可用
    await waitFor(() => expect(button.disabled).toBe(false))
  })

  it('onReset 失败时显示错误提示', async () => {
    const p = makePort()
    const onReset = vi.fn().mockRejectedValue(new Error('reset failed'))
    renderConsole({ port: p.port, onReset })
    fireEvent.click(screen.getByRole('button', { name: 'Reset Device' }))
    expect(await screen.findByText('Reset failed')).toBeTruthy()
  })
})
