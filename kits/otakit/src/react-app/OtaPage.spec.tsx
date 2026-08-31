import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocaleContext } from './i18n/useI18n'
import { OtaPage } from './OtaPage'
import type { OtaState } from './hooks/useOtaSession'

// ---- 打桩 useOtaSession：页面只消费 state/start/reset，避免真实 OtaSession 副作用 ----
const ota = vi.hoisted(() => ({
  state: { active: false, stage: 'idle', percent: 0 } as OtaState,
  start: vi.fn(),
  reset: vi.fn(),
}))

vi.mock('./hooks/useOtaSession', () => ({ useOtaSession: () => ota }))

/** 能力检测模拟：Web Serial + 安全上下文（happy-dom 默认 window.isSecureContext 需覆盖） */
function stubCapabilities({
  serial = true,
  secure = true,
}: {
  serial?: boolean
  secure?: boolean
}) {
  Object.defineProperty(window, 'isSecureContext', { value: secure, configurable: true })
  Object.defineProperty(navigator, 'serial', {
    value: serial ? { requestPort: vi.fn(), getPorts: vi.fn() } : undefined,
    configurable: true,
  })
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  stubCapabilities({ serial: true, secure: true })
})

describe('OtaPage 能力检测分支', () => {
  it('不支持 Web Serial 时渲染 unsupported（en-US）', () => {
    stubCapabilities({ serial: false, secure: true })
    render(
      <LocaleContext.Provider value="en-US">
        <OtaPage />
      </LocaleContext.Provider>,
    )
    expect(screen.getByText(/not supported/i)).toBeTruthy()
  })

  it('不支持 Web Serial 时渲染 unsupported（zh-CN）', () => {
    stubCapabilities({ serial: false, secure: true })
    render(
      <LocaleContext.Provider value="zh-CN">
        <OtaPage />
      </LocaleContext.Provider>,
    )
    expect(screen.getByText(/不支持 Web Serial/i)).toBeTruthy()
  })

  it('非安全上下文时渲染 insecure（en-US）', () => {
    stubCapabilities({ serial: true, secure: false })
    render(
      <LocaleContext.Provider value="en-US">
        <OtaPage />
      </LocaleContext.Provider>,
    )
    expect(screen.getByText(/secure context/i)).toBeTruthy()
  })

  it('支持 Web Serial 且安全上下文时渲染正常界面', () => {
    stubCapabilities({ serial: true, secure: true })
    render(
      <LocaleContext.Provider value="en-US">
        <OtaPage />
      </LocaleContext.Provider>,
    )
    expect(screen.getByRole('heading', { name: 'OTA Kit' })).toBeTruthy()
    expect(screen.getByText(/firmware url/i)).toBeTruthy()
    expect(screen.getByText(/start flashing/i)).toBeTruthy()
  })
})

describe('OtaPage 内容渲染与状态', () => {
  it('渲染标题与主区域（en-US）', () => {
    render(
      <LocaleContext.Provider value="en-US">
        <OtaPage />
      </LocaleContext.Provider>,
    )
    expect(screen.getByRole('heading', { name: 'OTA Kit' })).toBeTruthy()
    expect(screen.getByText('Firmware URL')).toBeTruthy()
    expect(screen.getByText('Start Flashing')).toBeTruthy()
  })

  it('渲染当前状态（progress 展示 stage）', () => {
    ota.state = { active: true, stage: 'programming', percent: 40 }
    render(
      <LocaleContext.Provider value="en-US">
        <OtaPage />
      </LocaleContext.Provider>,
    )
    expect(screen.getByText(/programming/i)).toBeTruthy()
    expect(screen.getByText(/40%/)).toBeTruthy()
  })

  it('中文文案通过 LocaleContext 渲染（zh-CN）', () => {
    render(
      <LocaleContext.Provider value="zh-CN">
        <OtaPage />
      </LocaleContext.Provider>,
    )
    expect(screen.getByRole('heading', { name: 'OTA 升级工具' })).toBeTruthy()
    expect(screen.getByText('固件 URL')).toBeTruthy()
    expect(screen.getByText('开始刷写')).toBeTruthy()
  })
})
