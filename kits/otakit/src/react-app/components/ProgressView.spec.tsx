import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { LocaleContext } from '../i18n/useI18n'
import { ProgressView } from './ProgressView'
import type { OtaState } from '../hooks/useOtaSession'

const WRAPPER = ({ children }: { children: React.ReactNode }) => (
  <LocaleContext.Provider value="zh-CN">{children}</LocaleContext.Provider>
)

afterEach(() => cleanup())

describe('ProgressView', () => {
  it('渲染 stage 与 percent', () => {
    const state: OtaState = { active: true, stage: 'programming', percent: 55 }
    render(<ProgressView state={state} />, { wrapper: WRAPPER })
    expect(screen.getByText(/编程中/)).toBeTruthy()
    expect(screen.getByText(/55%/)).toBeTruthy()
  })

  it('stage=done 渲染「完成」', () => {
    const state: OtaState = { active: false, stage: 'done', percent: 100 }
    render(<ProgressView state={state} />, { wrapper: WRAPPER })
    expect(screen.getByText(/完成/)).toBeTruthy()
  })

  it('failed 时渲染 error 文案', () => {
    const state: OtaState = { active: false, stage: 'failed', percent: 0, error: 'BOOT fail' }
    render(<ProgressView state={state} />, { wrapper: WRAPPER })
    expect(screen.getByText(/失败/)).toBeTruthy()
    expect(screen.getByText('BOOT fail')).toBeTruthy()
  })

  it('error 为已知 OtaError code 时按 i18n 取词（zh-CN）', () => {
    const state: OtaState = {
      active: false,
      stage: 'failed',
      percent: 0,
      error: 'xcp.connect_failed',
    }
    render(<ProgressView state={state} />, { wrapper: WRAPPER })
    expect(screen.getByText(/XCP 连接失败/)).toBeTruthy()
  })

  it('error 为已知 OtaError code 时按 i18n 取词（en-US）', () => {
    const state: OtaState = {
      active: false,
      stage: 'failed',
      percent: 0,
      error: 'xcp.connect_failed',
    }
    render(
      <LocaleContext.Provider value="en-US">
        <ProgressView state={state} />
      </LocaleContext.Provider>,
    )
    expect(screen.getByText(/XCP connect failed/)).toBeTruthy()
  })

  it('error 为已知 code 且带 errorDetail 时追加动态上下文', () => {
    const state: OtaState = {
      active: false,
      stage: 'failed',
      percent: 0,
      error: 'erase.failed',
      errorDetail: '0x8000000',
    }
    render(<ProgressView state={state} />, { wrapper: WRAPPER })
    expect(screen.getByText(/擦除失败 0x8000000/)).toBeTruthy()
  })

  it('error 为未知 code 时回退显示原文', () => {
    const state: OtaState = {
      active: false,
      stage: 'failed',
      percent: 0,
      error: 'some.unknown.code',
    }
    render(<ProgressView state={state} />, { wrapper: WRAPPER })
    expect(screen.getByText('some.unknown.code')).toBeTruthy()
  })
})
