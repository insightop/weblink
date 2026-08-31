import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocaleContext } from '../i18n/useI18n'
import { SerialSelect } from './SerialSelect'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

/** Stub navigator.serial.requestPort 返回假 port */
function stubRequestPort(port: unknown) {
  Object.defineProperty(navigator, 'serial', {
    value: { requestPort: vi.fn().mockResolvedValue(port), getPorts: vi.fn() },
    configurable: true,
  })
}

describe('SerialSelect', () => {
  it('点击「选择串口」调用 navigator.serial.requestPort 并把 port 传给 onSelect', async () => {
    const port = {} as SerialPort
    stubRequestPort(port)
    const onSelect = vi.fn()
    render(
      <LocaleContext.Provider value="zh-CN">
        <SerialSelect onSelect={onSelect} />
      </LocaleContext.Provider>,
    )
    fireEvent.click(screen.getByRole('button', { name: '选择串口' }))
    await vi.waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(port)
    })
  })

  it('用户取消选择时渲染错误提示', async () => {
    stubRequestPort(undefined)
    Object.defineProperty(navigator, 'serial', {
      value: {
        requestPort: vi.fn().mockRejectedValue(new Error('The port was cancelled')),
        getPorts: vi.fn(),
      },
      configurable: true,
    })
    const onSelect = vi.fn()
    render(
      <LocaleContext.Provider value="zh-CN">
        <SerialSelect onSelect={onSelect} />
      </LocaleContext.Provider>,
    )
    fireEvent.click(screen.getByRole('button', { name: '选择串口' }))
    expect(await screen.findByText('The port was cancelled')).toBeTruthy()
    expect(onSelect).not.toHaveBeenCalled()
  })
})
