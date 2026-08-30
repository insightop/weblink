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
  scanGraceExpired?: boolean
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
        scanGraceExpired={props.scanGraceExpired ?? false}
        busy={props.busy ?? false}
        onSubmit={onSubmit}
        onRescan={onRescan}
      />
    </I18nProvider>,
  )
  return { onSubmit, onRescan, ...utils }
}

/** 以新 networks 重新渲染（同一渲染根，保留组件内部 ref 状态） */
function rerenderWifiForm(
  utils: ReturnType<typeof renderForm>,
  props: { networks?: Ssid[] | null },
) {
  utils.rerender(
    <I18nProvider locale="en-US">
      <WifiForm
        networks={props.networks}
        busy={false}
        onSubmit={utils.onSubmit}
        onRescan={utils.onRescan}
      />
    </I18nProvider>,
  )
}

afterEach(() => cleanup())

describe('WifiForm', () => {
  it('网络列表首次就绪：自动预选信号最强的网络（home-5g）填入手动输入框', () => {
    renderForm({ networks: NETWORKS })
    expect(screen.getByRole('button', { name: /home-5g/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /guest/ })).toBeTruthy()

    const ssidInput = screen.getByLabelText('Wi-Fi Network') as HTMLInputElement
    // 预选最强网络（D15）：home-5g 的 RSSI -42 > guest -67
    expect(ssidInput.value).toBe('home-5g')
    expect((screen.getByRole('button', { name: 'Connect' }) as HTMLButtonElement).disabled).toBe(
      false,
    )
  })

  it('慢启动：首次扫描返回空数组、第二轮才返回含网络的数组时，仍预选信号最强的网络', () => {
    // 刚烧录/刚启动设备首扫尚未返回网络（[]），随后才扫出信号强度不同的网络。
    // 预选必须在「首个非空数组」到达时触发，而非首个数组（否则空数组会吞掉预选）。
    const utils = renderForm({ networks: [] })
    expect((screen.getByLabelText('Wi-Fi Network') as HTMLInputElement).value).toBe('')

    rerenderWifiForm(utils, { networks: NETWORKS })
    const ssidInput = screen.getByLabelText('Wi-Fi Network') as HTMLInputElement
    // 第二轮非空列表到达：home-5g（rssi -42）最强，应被预选填入手动输入框
    expect(ssidInput.value).toBe('home-5g')
    expect((screen.getByRole('button', { name: 'Connect' }) as HTMLButtonElement).disabled).toBe(
      false,
    )
  })

  it('点选列表条目回填 SSID 输入框并替换预选', () => {
    renderForm({ networks: NETWORKS })
    const ssidInput = screen.getByLabelText('Wi-Fi Network') as HTMLInputElement
    expect(ssidInput.value).toBe('home-5g') // 预选

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

  it('networks 为空数组（已扫描但无网络）：显示「未发现网络」提示；undefined 未就绪时显示「正在扫描」', () => {
    renderForm({ networks: [] })
    expect(screen.getByText('No networks found.')).toBeTruthy()
    cleanup()
    renderForm({})
    // 未就绪（undefined）不显示空态，而是"正在扫描"
    expect(screen.queryByText('No networks found.')).toBeNull()
    expect(screen.getByText('Scanning for networks…')).toBeTruthy()
  })

  it('首扫宽限期已过仍无结果（networks undefined + scanGraceExpired）：显示「未发现网络」空态', () => {
    renderForm({ networks: undefined, scanGraceExpired: true })
    expect(screen.getByText('No networks found.')).toBeTruthy()
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

  it('选中的网络从后续扫描消失：回填手动输入框、保留密码并提示掉线回填', () => {
    // 首次列表预选 home-5g；用户再输入密码
    const utils = renderForm({ networks: NETWORKS })
    const ssidInput = screen.getByLabelText('Wi-Fi Network') as HTMLInputElement
    expect(ssidInput.value).toBe('home-5g')
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } })

    // 下一轮扫描 home-5g 消失（只剩 guest）：选中的 home-5g 被回填到输入框
    rerenderWifiForm(utils, {
      networks: [{ name: 'guest', rssi: -60, secured: false }],
    })
    expect(ssidInput.value).toBe('home-5g') // 回填保留选择
    expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe('secret') // 密码保留
    expect(screen.getByTestId('scan-backfill')).toBeTruthy() // 回填提示
    expect((screen.getByRole('button', { name: 'Connect' }) as HTMLButtonElement).disabled).toBe(
      false,
    ) // 可直接提交重试
  })

  it('用户手动改过 SSID 后再刷新列表：不覆盖其手动输入', () => {
    const utils = renderForm({ networks: NETWORKS })
    const ssidInput = screen.getByLabelText('Wi-Fi Network') as HTMLInputElement
    fireEvent.change(ssidInput, { target: { value: 'my-manual-wifi' } })

    rerenderWifiForm(utils, { networks: NETWORKS })
    expect(ssidInput.value).toBe('my-manual-wifi')
  })

  it('预选后手动改 SSID，目标网络掉线：不回填不覆盖用户输入、不弹回填提示', () => {
    // F1 回归：预选 home-5g（selectedSsidRef 记录为 home-5g）后用户手动改为 foo，
    // 此时已脱离"列表选中项"跟踪。下一轮网络 home-5g 掉线，掉线检测不得再以
    // 预选残留的 home-5g 对本来源生效——否则会把用户手动输入覆盖回 home-5g。
    const utils = renderForm({ networks: NETWORKS })
    const ssidInput = screen.getByLabelText('Wi-Fi Network') as HTMLInputElement
    expect(ssidInput.value).toBe('home-5g') // 预选写入

    // 手动改写 SSID：脱离列表选中跟踪
    fireEvent.change(ssidInput, { target: { value: 'foo' } })
    expect(ssidInput.value).toBe('foo')

    // 下一轮扫描 home-5g 消失（只剩 guest）：不得触发回填覆盖手动输入 foo
    rerenderWifiForm(utils, {
      networks: [{ name: 'guest', rssi: -60, secured: false }],
    })
    expect(ssidInput.value).toBe('foo') // 保留用户手动输入
    expect(screen.queryByTestId('scan-backfill')).toBeNull()
  })

  it('首扫预选后，二扫出现更强的网络：不翻转已建立的预选（guard 隔离）', () => {
    // F3 回归：selectionEstablishedRef guard 保证「已有选择决策」后，更强的网络
    // 不得在后续扫描翻转当前 SSID。二扫 home-5g 仍在，只新增更强的 zzz 时，
    // SSID 必须保持 home-5g，且不触发回填提示（home-5g 并未掉线）。
    const utils = renderForm({ networks: NETWORKS })
    const ssidInput = screen.getByLabelText('Wi-Fi Network') as HTMLInputElement
    expect(ssidInput.value).toBe('home-5g') // 首扫预选

    rerenderWifiForm(utils, {
      networks: [
        { name: 'zzz', rssi: -20, secured: false }, // 新增更强信号
        ...NETWORKS, // home-5g（-42）仍在
      ],
    })
    expect(ssidInput.value).toBe('home-5g') // 不被更强的 zzz 抢走
    expect(screen.queryByTestId('scan-backfill')).toBeNull() // home-5g 未掉线
  })
})
