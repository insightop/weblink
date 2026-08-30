import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Ssid } from '../../domain/types'
import { I18nProvider } from '../i18n/react'
import { WifiForm } from './WifiForm'

const NETWORKS: Ssid[] = [
  { name: 'home-5g', rssi: -42, secured: true },
  { name: 'guest', rssi: -67, secured: false },
]

function renderForm(props: {
  networks?: Ssid[] | null
  busy?: boolean
  onSubmit?: (ssid: string, password: string) => void
  onRescan?: () => void
}) {
  const onSubmit = props.onSubmit ?? vi.fn()
  const onRescan = props.onRescan ?? vi.fn()
  const utils = render(
    <I18nProvider locale="en-US">
      <WifiForm
        networks={props.networks}
        busy={props.busy ?? false}
        onSubmit={onSubmit}
        onRescan={onRescan}
      />
    </I18nProvider>,
  )
  return { onSubmit, onRescan, ...utils }
}

afterEach(() => cleanup())

describe('WifiForm', () => {
  it('网络列表：渲染名称，点选条目回填 SSID 输入框并使提交可用', () => {
    renderForm({ networks: NETWORKS })
    expect(screen.getByRole('button', { name: /home-5g/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /guest/ })).toBeTruthy()

    const ssidInput = screen.getByLabelText('Wi-Fi Network') as HTMLInputElement
    expect(ssidInput.value).toBe('')
    expect((screen.getByRole('button', { name: 'Connect' }) as HTMLButtonElement).disabled).toBe(
      true,
    )

    fireEvent.click(screen.getByRole('button', { name: /guest/ }))
    expect(ssidInput.value).toBe('guest')
    expect((screen.getByRole('button', { name: 'Connect' }) as HTMLButtonElement).disabled).toBe(
      false,
    )
  })

  it('列表条目带信号强度档位、加密标志与可访问名称（名称 + 信号档 + 加密态）', () => {
    renderForm({ networks: NETWORKS })
    const home = screen.getByRole('button', { name: /home-5g/ })
    const guest = screen.getByRole('button', { name: /guest/ })
    // aria-label 覆盖可访问名称：名称 + 信号档（4 档满格 / 2 格）+ 加密态
    expect(home.getAttribute('aria-label')).toBe('home-5g — signal 4/4, secured')
    expect(guest.getAttribute('aria-label')).toBe('guest — signal 2/4, open')
    // 每格恒定渲染四格（testid signal-bar-N），点亮格以 on 变体计数：
    // 强信号（rssi -42 ≥ -50）满格四亮；弱信号（-67）仅两格
    const litBars = (item: HTMLElement) => within(item).getAllByTestId(/signal-bar-on/).length
    expect(within(home).getAllByTestId(/^signal-bar/).length).toBe(4)
    expect(within(guest).getAllByTestId(/^signal-bar/).length).toBe(4)
    expect(litBars(home)).toBe(4)
    expect(litBars(guest)).toBe(2)
    expect(within(home).getByTestId('lock-mark')).toBeTruthy()
    expect(within(guest).queryByTestId('lock-mark')).toBeNull()
  })

  it('networks 为 null（设备不支持扫描）：显示手动输入提示，无网络列表与重新扫描入口', () => {
    renderForm({ networks: null })
    expect(
      screen.getByText('This device cannot scan for networks. Enter the Wi-Fi name manually.'),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: /home-5g/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Rescan' })).toBeNull()
    // 手动输入仍可用
    const ssidInput = screen.getByLabelText('Wi-Fi Network') as HTMLInputElement
    fireEvent.change(ssidInput, { target: { value: 'manual-ssid' } })
    expect((screen.getByRole('button', { name: 'Connect' }) as HTMLButtonElement).disabled).toBe(
      false,
    )
  })

  it('networks 为空数组（已扫描但无网络）：显示「未发现网络」提示；未扫描（undefined）不显示', () => {
    renderForm({ networks: [] })
    expect(screen.getByText('No networks found.')).toBeTruthy()
    cleanup()
    renderForm({})
    expect(screen.queryByText('No networks found.')).toBeNull()
  })

  it('同名校、不同信号与加密态的网络均渲染：复合 key 不触发重复键告警', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      renderForm({
        networks: [
          { name: 'home', rssi: -42, secured: true },
          { name: 'home', rssi: -75, secured: false },
        ],
      })
      expect(screen.getAllByRole('button', { name: /home/ })).toHaveLength(2)
      const duplicateKeyWarnings = errorSpy.mock.calls.filter((args) =>
        String(args[0]).includes('duplicate'),
      )
      expect(duplicateKeyWarnings).toHaveLength(0)
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('busy 时重新扫描按钮禁用，防止并发扫描；busy 复位后恢复可用', () => {
    const { rerender } = renderForm({ networks: NETWORKS, busy: true })
    expect((screen.getByRole('button', { name: 'Rescan' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
    rerender(
      <I18nProvider locale="en-US">
        <WifiForm networks={NETWORKS} busy={false} onSubmit={vi.fn()} onRescan={vi.fn()} />
      </I18nProvider>,
    )
    expect((screen.getByRole('button', { name: 'Rescan' }) as HTMLButtonElement).disabled).toBe(
      false,
    )
  })

  it('密码可见性切换：默认 password，点击显示后变 text，再点击恢复', () => {
    renderForm({ networks: [] })
    const passwordInput = screen.getByLabelText('Password') as HTMLInputElement
    expect(passwordInput.type).toBe('password')

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect((screen.getByLabelText('Password') as HTMLInputElement).type).toBe('text')
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }))
    expect((screen.getByLabelText('Password') as HTMLInputElement).type).toBe('password')
  })

  it('空 SSID 禁用提交；填 SSID 后启用；busy 时即便有输入也禁用', () => {
    const { rerender } = renderForm({ networks: [] })
    const submit = () => screen.getByRole('button', { name: 'Connect' }) as HTMLButtonElement
    expect(submit().disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('Wi-Fi Network'), { target: { value: 'my-wifi' } })
    expect(submit().disabled).toBe(false)

    rerender(
      <I18nProvider locale="en-US">
        <WifiForm networks={[]} busy={true} onSubmit={vi.fn()} onRescan={vi.fn()} />
      </I18nProvider>,
    )
    expect(submit().disabled).toBe(true)
  })

  it('提交：携带去除首尾空白的 SSID 与密码回调 onSubmit', () => {
    const { onSubmit } = renderForm({ networks: [] })
    fireEvent.change(screen.getByLabelText('Wi-Fi Network'), { target: { value: '  my-wifi  ' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }))
    expect(onSubmit).toHaveBeenCalledWith('my-wifi', 'secret')
  })

  it('网络列表存在时提供重新扫描入口，点击回调 onRescan', () => {
    const { onRescan } = renderForm({ networks: NETWORKS })
    fireEvent.click(screen.getByRole('button', { name: 'Rescan' }))
    expect(onRescan).toHaveBeenCalledTimes(1)
  })
})
