import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DeviceInfo, Ssid } from '../../domain/types'
import { I18nProvider, type Locale } from '../i18n/react'
import { ProvisionPage, ProvisionView, type ProvisionViewProps } from './ProvisionPage'

const DEVICE: DeviceInfo = {
  name: 'improv-test',
  firmware: '1.0.0',
  version: '2.0.0',
  chipFamily: 'ESP32',
  osName: 'FreeRTOS',
  osVersion: '1.2.3',
}

const NETWORKS: Ssid[] = [
  { name: 'home-5g', rssi: -42, secured: true },
  { name: 'guest', rssi: -67, secured: false },
]

/**
 * ProvisionView 测试数据工厂：直接注入视图所需属性，避免 vi.mock useImprovSession
 * 模块（页面拆分为接受 hook 结果的内部组件后，纯渲染路径即可被独立覆盖）。
 */
function makeSession(overrides: Partial<ProvisionViewProps> = {}): ProvisionViewProps {
  return {
    state: 'IDLE',
    deviceInfo: undefined,
    networks: undefined,
    scanUnavailable: false,
    scanGraceExpired: false,
    errorCategory: undefined,
    lastUrl: undefined,
    busy: false,
    connect: vi.fn(),
    refreshScan: vi.fn(),
    submitCredentials: vi.fn(),
    changeWifi: vi.fn(),
    reset: vi.fn(),
    onReconnect: vi.fn(),
    enterConsole: vi.fn(),
    exitConsole: vi.fn(),
    resetConsole: vi.fn(),
    resetDevice: vi.fn(async () => {}),
    resetNotice: false,
    onReset: vi.fn(async () => {}),
    ...overrides,
  }
}

/** 以指定语言渲染纯视图（ProvisionPage 的 locale 探测定位于 ProvisionPage 用例） */
function renderView(overrides: Partial<ProvisionViewProps> = {}, locale: Locale = 'en-US') {
  return render(
    <I18nProvider locale={locale}>
      <ProvisionView {...makeSession(overrides)} />
    </I18nProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ProvisionView 状态渲染', () => {
  it('IDLE：连接入口面板（标题 + 连接设备按钮）', () => {
    renderView()
    expect(screen.getByRole('heading', { name: 'Improv Wi-Fi Setup' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Connect Device' })).toBeTruthy()
  })

  it('READY 全链路：设备信息卡 + 网络列表 + 凭据表单同帧呈现，无连接入口', () => {
    renderView({ state: 'READY', deviceInfo: DEVICE, networks: NETWORKS })
    expect(screen.getByText('improv-test')).toBeTruthy()
    expect(screen.getByRole('button', { name: /home-5g/ })).toBeTruthy()
    expect(screen.getByLabelText('Wi-Fi Network')).toBeTruthy()
    expect(screen.getByLabelText('Password')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Connect Device' })).toBeNull()
  })

  it('READY 且 errorCategory 存在（断连等异步错误）：表单上方渲染错误提示条', () => {
    renderView({
      state: 'READY',
      deviceInfo: DEVICE,
      networks: NETWORKS,
      errorCategory: 'DISCONNECTED',
    })
    expect(screen.getByText('The connection to the device was lost.')).toBeTruthy()
    expect(screen.getByLabelText('Password')).toBeTruthy() // 表单保留
  })

  it('ERROR 且 deviceInfo 保留（配网失败表单语境）：保留表单 + 错误条，可直接重试（spec 密码错误场景）', () => {
    renderView({
      state: 'ERROR',
      deviceInfo: DEVICE,
      networks: NETWORKS,
      errorCategory: 'UNABLE_TO_CONNECT',
    })
    expect(screen.getByText('Unable to connect to this Wi-Fi network.')).toBeTruthy()
    expect(screen.getByText('improv-test')).toBeTruthy()
    expect(screen.getByRole('button', { name: /home-5g/ })).toBeTruthy()
    expect(screen.getByLabelText('Password')).toBeTruthy()
    // 非断连类别：不出现「重新连接设备」按钮
    expect(screen.queryByRole('button', { name: 'Reconnect Device' })).toBeNull()
  })

  it('ERROR + DISCONNECTED（表单语境物理断连）：渲染「重新连接设备」按钮，点击触发 onReconnect 回调', () => {
    const onReconnect = vi.fn()
    renderView({
      state: 'ERROR',
      deviceInfo: DEVICE,
      networks: NETWORKS,
      errorCategory: 'DISCONNECTED',
      onReconnect,
    })
    // 表单语境保留：重连入口出现于表单上方
    expect(screen.getByLabelText('Password')).toBeTruthy()
    const button = screen.getByRole('button', { name: 'Reconnect Device' }) as HTMLButtonElement
    fireEvent.click(button)
    expect(onReconnect).toHaveBeenCalledTimes(1)
  })

  it('ERROR 且无 deviceInfo（连接期失败）：连接面板错误态 + 重试按钮', () => {
    renderView({ state: 'ERROR', errorCategory: 'NOT_IMPROV_DEVICE' })
    expect(screen.getByText('This device is not an Improv device.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    expect(screen.queryByLabelText('Password')).toBeNull()
  })

  it('PROVISIONING：配网进度视图', () => {
    renderView({ state: 'PROVISIONING', busy: true })
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByText('Provisioning…')).toBeTruthy()
  })

  it('PROVISIONED：成功页（成功标题 + 访问设备 + 更换 Wi-Fi 触发 changeWifi 回调）', () => {
    const props = makeSession({
      state: 'PROVISIONED',
      deviceInfo: DEVICE,
      lastUrl: 'http://device.local',
    })
    render(
      <I18nProvider locale="en-US">
        <ProvisionView {...props} />
      </I18nProvider>,
    )
    expect(screen.getByText('Provisioning Successful')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Visit Device' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Change Wi-Fi' }))
    expect(props.changeWifi).toHaveBeenCalledTimes(1)
  })

  it('PROVISIONED 且无 lastUrl（连接时设备已配网）：成功页 + 更换 Wi-Fi，不渲染外链', () => {
    const props = makeSession({
      state: 'PROVISIONED',
      deviceInfo: DEVICE,
      lastUrl: undefined,
    })
    render(
      <I18nProvider locale="en-US">
        <ProvisionView {...props} />
      </I18nProvider>,
    )
    // 连接时已配网（非刚配网成功）：设备未提供跳转 URL，成功页仍渲染
    expect(screen.getByText('Provisioning Successful')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Visit Device' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Change Wi-Fi' })).toBeTruthy()
  })
})

describe('zh-CN 文案抽查', () => {
  it('IDLE：连接设备按钮为中文', () => {
    renderView({}, 'zh-CN')
    expect(screen.getByRole('button', { name: '连接设备' })).toBeTruthy()
  })

  it('READY：Wi-Fi 网络 / 密码标签为中文', () => {
    renderView({ state: 'READY', deviceInfo: DEVICE, networks: NETWORKS }, 'zh-CN')
    expect(screen.getByLabelText('Wi-Fi 网络')).toBeTruthy()
    expect(screen.getByLabelText('密码')).toBeTruthy()
  })

  it('PROVISIONED：成功标题为中文', () => {
    renderView({ state: 'PROVISIONED', deviceInfo: DEVICE }, 'zh-CN')
    expect(screen.getByText('配网成功')).toBeTruthy()
  })
})

describe('ProvisionPage 能力检测门', () => {
  it('安全上下文 + 支持 Web Serial：渲染连接入口', () => {
    vi.stubGlobal('navigator', { language: 'en-US', serial: {} })
    vi.stubGlobal('isSecureContext', true)
    render(<ProvisionPage />)
    expect(screen.getByRole('button', { name: 'Connect Device' })).toBeTruthy()
  })

  it('非安全上下文：渲染 insecure 提示页，无连接入口', () => {
    vi.stubGlobal('navigator', { language: 'en-US', serial: {} })
    vi.stubGlobal('isSecureContext', false)
    render(<ProvisionPage />)
    expect(
      screen.getByText(
        'Serial ports require a secure context. Open this page over HTTPS or localhost.',
      ),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Connect Device' })).toBeNull()
  })

  it('无 Web Serial：渲染 unsupported 提示页，无连接入口', () => {
    vi.stubGlobal('navigator', { language: 'en-US' })
    vi.stubGlobal('isSecureContext', true)
    render(<ProvisionPage />)
    expect(
      screen.getByText('Web Serial is not supported in this browser. Please use Chrome or Edge.'),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Connect Device' })).toBeNull()
  })

  it('未传 locale 时按 navigator.language 探测：zh-CN 浏览器渲染中文连接按钮', () => {
    vi.stubGlobal('navigator', { language: 'zh-CN', serial: {} })
    vi.stubGlobal('isSecureContext', true)
    render(<ProvisionPage />)
    expect(screen.getByRole('button', { name: '连接设备' })).toBeTruthy()
  })

  it('显式 locale 优先于浏览器语言', () => {
    vi.stubGlobal('navigator', { language: 'en-US', serial: {} })
    vi.stubGlobal('isSecureContext', true)
    render(<ProvisionPage locale="zh-CN" />)
    expect(screen.getByRole('button', { name: '连接设备' })).toBeTruthy()
  })
})

describe('ProvisionView 控制台接线', () => {
  it('READY 表单态提供「日志与控制台」入口，点击触发 enterConsole 回调', () => {
    const enterConsole = vi.fn()
    renderView({ state: 'READY', deviceInfo: DEVICE, networks: NETWORKS, enterConsole })
    const entry = screen.getByRole('button', { name: 'Logs & Console' })
    expect(entry).toBeTruthy()
    fireEvent.click(entry)
    expect(enterConsole).toHaveBeenCalledTimes(1)
  })

  it('consolePort 存在时渲染 ConsoleView 替代配网视图（表单被屏蔽）', () => {
    const exitConsole = vi.fn()
    const onReset = vi.fn(async () => {})
    renderView({
      state: 'READY',
      deviceInfo: DEVICE,
      networks: NETWORKS,
      consolePort: { readable: null, writable: null },
      exitConsole,
      onReset,
    })
    // 控制台视图替代配网表单：表单与网络列表均不渲染
    expect(screen.getByText('Serial Console')).toBeTruthy()
    expect(screen.queryByLabelText('Wi-Fi Network')).toBeNull()
    expect(screen.queryByRole('button', { name: /home-5g/ })).toBeNull()
  })

  it('consolePort 存在时渲染 ConsoleView 替代成功页（成功页被屏蔽）', () => {
    renderView({
      state: 'PROVISIONED',
      deviceInfo: DEVICE,
      lastUrl: 'http://device.local',
      consolePort: { readable: null, writable: null },
    })
    expect(screen.getByText('Serial Console')).toBeTruthy()
    expect(screen.queryByText('Provisioning Successful')).toBeNull()
  })

  it('ConsoleView 的退出按钮触发 exitConsole 回调', () => {
    const exitConsole = vi.fn()
    renderView({
      state: 'READY',
      deviceInfo: DEVICE,
      consolePort: { readable: null, writable: null },
      exitConsole,
    })
    fireEvent.click(screen.getByRole('button', { name: 'Exit' }))
    expect(exitConsole).toHaveBeenCalledTimes(1)
  })

  it('ConsoleView 的复位按钮触发 onReset 回调（handleReset）', () => {
    const onReset = vi.fn(async () => {})
    renderView({
      state: 'READY',
      deviceInfo: DEVICE,
      consolePort: { readable: null, writable: null },
      onReset,
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reset Device' }))
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it('handleReset 返回真实复位 promise：复位失败时 ConsoleView 展示失败提示（I1）', async () => {
    // 模拟真实接线：SessionHost 的 handleReset 在 resetDevice 存在时返回其 promise，
    // 复位失败会 reject → ConsoleView 的 handleReset 捕获并展示错误提示
    const onReset = vi.fn(async () => {
      throw new Error('reset failed')
    })
    renderView({
      state: 'READY',
      deviceInfo: DEVICE,
      consolePort: { readable: null, writable: null },
      onReset,
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reset Device' }))
    // 复位失败路径经真实 promise 传播到 ConsoleView 的错误提示
    expect(await screen.findByText('Reset failed')).toBeTruthy()
  })

  it('复位后（resetNotice）回到配网入口视图并提示重新连接（console_reset_reconnect）', () => {
    renderView({
      state: 'IDLE',
      resetNotice: true,
    })
    // 复位重启设备后 Improv 会话失效：回到连接入口，提示用户重新连接
    expect(screen.getByRole('heading', { name: 'Improv Wi-Fi Setup' })).toBeTruthy()
    expect(screen.getByText('Device reset. Reconnect to continue.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Connect Device' })).toBeTruthy()
  })

  it('复位后（resetNotice）在 READY 表单语境同样展示重新连接提示', () => {
    renderView({
      state: 'READY',
      deviceInfo: DEVICE,
      networks: NETWORKS,
      resetNotice: true,
    })
    expect(screen.getByText('Device reset. Reconnect to continue.')).toBeTruthy()
    expect(screen.getByLabelText('Password')).toBeTruthy()
  })

  it('zh-CN：复位后提示重新连接为中文', () => {
    renderView({ state: 'IDLE', resetNotice: true }, 'zh-CN')
    expect(screen.getByText('设备已复位，请重新连接以继续')).toBeTruthy()
  })
})
