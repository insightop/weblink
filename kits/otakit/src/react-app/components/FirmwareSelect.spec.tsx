import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocaleContext } from '../i18n/useI18n'
import { FirmwareSelect } from './FirmwareSelect'

const WRAPPER = ({ children }: { children: React.ReactNode }) => (
  <LocaleContext.Provider value="zh-CN">{children}</LocaleContext.Provider>
)

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('FirmwareSelect', () => {
  it('URL 输入变化时回调 onUrlChange', () => {
    const onUrlChange = vi.fn()
    render(
      <FirmwareSelect
        initialUrl=""
        onUrlChange={onUrlChange}
        onFile={vi.fn()}
        onUrlFetch={vi.fn()}
      />,
      { wrapper: WRAPPER },
    )
    const input = screen.getByPlaceholderText('固件 URL')
    fireEvent.change(input, { target: { value: 'https://example.com/a.hex' } })
    expect(onUrlChange).toHaveBeenCalledWith('https://example.com/a.hex')
  })

  it('点击「下载固件」以当前 URL 回调 onUrlFetch', () => {
    const onUrlFetch = vi.fn()
    render(
      <FirmwareSelect
        initialUrl="https://example.com/a.hex"
        onUrlChange={vi.fn()}
        onFile={vi.fn()}
        onUrlFetch={onUrlFetch}
      />,
      { wrapper: WRAPPER },
    )
    fireEvent.click(screen.getByRole('button', { name: '下载固件' }))
    expect(onUrlFetch).toHaveBeenCalledWith('https://example.com/a.hex')
  })

  it('URL 为空时点击「下载固件」不回调', () => {
    const onUrlFetch = vi.fn()
    render(
      <FirmwareSelect
        initialUrl=""
        onUrlChange={vi.fn()}
        onFile={vi.fn()}
        onUrlFetch={onUrlFetch}
      />,
      { wrapper: WRAPPER },
    )
    fireEvent.click(screen.getByRole('button', { name: '下载固件' }))
    expect(onUrlFetch).not.toHaveBeenCalled()
  })

  it('选择本地文件时回调 onFile', () => {
    const onFile = vi.fn()
    const file = new File([':020000040000FA\n:00000001FF\n'], 'fw.hex', { type: 'text/plain' })
    render(
      <FirmwareSelect initialUrl="" onUrlChange={vi.fn()} onFile={onFile} onUrlFetch={vi.fn()} />,
      { wrapper: WRAPPER },
    )
    const input = screen.getByLabelText('上传固件')
    fireEvent.change(input, { target: { files: [file] } })
    expect(onFile).toHaveBeenCalledWith(file)
  })
})
