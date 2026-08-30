import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DomainErrorCategory } from '../../domain/errors'
import { I18nProvider } from '../i18n/react'
import { ConnectionPanel } from './ConnectionPanel'

/** 用 en-US 字典渲染面板：仅验证渲染与回调，文案键语义由 dictionaries.spec 锁定 */
function renderPanel(props: {
  state: 'IDLE' | 'CONNECTING' | 'ERROR'
  errorCategory?: DomainErrorCategory
  busy?: boolean
  onConnect?: () => void
  onCancel?: () => void
}) {
  const onConnect = props.onConnect ?? vi.fn()
  const onCancel = props.onCancel ?? vi.fn()
  const utils = render(
    <I18nProvider locale="en-US">
      <ConnectionPanel
        state={props.state}
        errorCategory={props.errorCategory}
        busy={props.busy}
        onConnect={onConnect}
        onCancel={onCancel}
      />
    </I18nProvider>,
  )
  return { onConnect, onCancel, ...utils }
}

afterEach(() => cleanup())

describe('ConnectionPanel', () => {
  it('IDLE：标题 + 描述 + 连接按钮，点击回调 onConnect', () => {
    const { onConnect } = renderPanel({ state: 'IDLE' })
    expect(screen.getByRole('heading', { name: 'Improv Wi-Fi Setup' })).toBeTruthy()
    expect(screen.getByText('Connect your device to a Wi-Fi network using Improv')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Connect Device' }))
    expect(onConnect).toHaveBeenCalledTimes(1)
  })

  it('IDLE 且 busy（会话动作进行中）：连接按钮禁用，防止重入发起第二次连接', () => {
    renderPanel({ state: 'IDLE', busy: true })
    expect(
      (screen.getByRole('button', { name: 'Connect Device' }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })

  it('IDLE 且 busy=false：连接按钮可用', () => {
    renderPanel({ state: 'IDLE', busy: false })
    expect(
      (screen.getByRole('button', { name: 'Connect Device' }) as HTMLButtonElement).disabled,
    ).toBe(false)
  })

  it('CONNECTING：进度文案 + 取消按钮，点击回调 onCancel 而非 onConnect', () => {
    const { onCancel, onConnect } = renderPanel({ state: 'CONNECTING' })
    expect(screen.getByText('Connecting…')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConnect).not.toHaveBeenCalled()
    // 连接中不应出现入口面板的标题与连接按钮
    expect(screen.queryByRole('button', { name: 'Connect Device' })).toBeNull()
  })

  it('ERROR 且带错误类别：错误提示条（按类别取词）+ 重试按钮回调 onConnect', () => {
    const { onConnect } = renderPanel({ state: 'ERROR', errorCategory: 'TIMEOUT' })
    expect(screen.getByText('The operation timed out. Please retry.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onConnect).toHaveBeenCalledTimes(1)
  })

  it('ERROR 且无错误类别（hook 理论不可达的兜底）：不渲染错误条，仍提供重试按钮', () => {
    const { onConnect } = renderPanel({ state: 'ERROR' })
    expect(screen.queryByRole('alert')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onConnect).toHaveBeenCalledTimes(1)
  })
})
