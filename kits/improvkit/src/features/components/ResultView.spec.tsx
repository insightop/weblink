import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DeviceInfo } from '../../domain/types'
import { I18nProvider } from '../i18n/react'
import { ResultView } from './ResultView'

const DEVICE: DeviceInfo = {
  name: 'improv-test',
  firmware: '1.0.0',
  version: '2.0.0',
  chipFamily: 'ESP32',
  osName: null,
  osVersion: null,
}

function renderResult(props: {
  deviceInfo?: DeviceInfo
  lastUrl?: string
  onChangeWifi?: () => void
  onOpenConsole?: () => void
}) {
  const onChangeWifi = props.onChangeWifi ?? vi.fn()
  const onOpenConsole = props.onOpenConsole ?? vi.fn()
  const utils = render(
    <I18nProvider locale="en-US">
      <ResultView
        deviceInfo={props.deviceInfo}
        lastUrl={props.lastUrl}
        onChangeWifi={onChangeWifi}
        onOpenConsole={onOpenConsole}
      />
    </I18nProvider>,
  )
  return { onChangeWifi, onOpenConsole, ...utils }
}

afterEach(() => cleanup())

describe('ResultView', () => {
  it('成功页：成功标题 + 设备信息卡 + 访问设备外链（新窗口打开）+ 更换 Wi-Fi 按钮', () => {
    const { onChangeWifi } = renderResult({
      deviceInfo: DEVICE,
      lastUrl: 'http://device.local',
    })
    expect(screen.getByText('Provisioning Successful')).toBeTruthy()
    expect(screen.getByText('improv-test')).toBeTruthy()
    expect(screen.getByText('ESP32')).toBeTruthy()

    const link = screen.getByRole('link', { name: 'Visit Device' })
    expect(link.getAttribute('href')).toBe('http://device.local')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noreferrer')

    fireEvent.click(screen.getByRole('button', { name: 'Change Wi-Fi' }))
    expect(onChangeWifi).toHaveBeenCalledTimes(1)
  })

  it('无 lastUrl（设备未返回跳转地址）：不渲染访问设备外链', () => {
    renderResult({ deviceInfo: DEVICE })
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('Provisioning Successful')).toBeTruthy()
  })

  it('非 http/https 的 lastUrl（javascript:）：不渲染外链，仅显示文本', () => {
    renderResult({ deviceInfo: DEVICE, lastUrl: 'javascript:alert(1)' })
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('javascript:alert(1)')).toBeTruthy()
  })

  it('无法解析为 URL 的 lastUrl（相对路径等）：不渲染外链，仅显示文本', () => {
    renderResult({ deviceInfo: DEVICE, lastUrl: '/admin' })
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('/admin')).toBeTruthy()
  })

  it('deviceInfo 缺席（理论不可达兜底）：成功页仍可渲染且可换网', () => {
    const { onChangeWifi } = renderResult({})
    expect(screen.getByText('Provisioning Successful')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Change Wi-Fi' }))
    expect(onChangeWifi).toHaveBeenCalledTimes(1)
  })

  it('成功页提供「日志与控制台」入口，点击触发 onOpenConsole 回调', () => {
    const { onOpenConsole } = renderResult({ deviceInfo: DEVICE })
    const entry = screen.getByRole('button', { name: 'Logs & Console' })
    expect(entry).toBeTruthy()
    fireEvent.click(entry)
    expect(onOpenConsole).toHaveBeenCalledTimes(1)
  })
})
