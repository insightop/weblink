import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { DeviceInfo } from '../../domain/types'
import { I18nProvider } from '../i18n/react'
import { DeviceInfoCard } from './DeviceInfoCard'

const FULL_INFO: DeviceInfo = {
  name: 'improv-test',
  firmware: '1.0.0',
  version: '2.0.0',
  chipFamily: 'ESP32',
  osName: 'FreeRTOS',
  osVersion: '1.2.3',
}

function renderCard(info: DeviceInfo) {
  return render(
    <I18nProvider locale="en-US">
      <DeviceInfoCard info={info} />
    </I18nProvider>,
  )
}

afterEach(() => cleanup())

describe('DeviceInfoCard', () => {
  it('全字段：六行标签与值齐全（osName/osVersion 有值也渲染）', () => {
    renderCard(FULL_INFO)
    expect(screen.getByText('Device Name')).toBeTruthy()
    expect(screen.getByText('improv-test')).toBeTruthy()
    expect(screen.getByText('Firmware')).toBeTruthy()
    expect(screen.getByText('1.0.0')).toBeTruthy()
    expect(screen.getByText('Version')).toBeTruthy()
    expect(screen.getByText('2.0.0')).toBeTruthy()
    expect(screen.getByText('Chip Family')).toBeTruthy()
    expect(screen.getByText('ESP32')).toBeTruthy()
    expect(screen.getByText('Operating System')).toBeTruthy()
    expect(screen.getByText('FreeRTOS')).toBeTruthy()
    expect(screen.getByText('OS Version')).toBeTruthy()
    expect(screen.getByText('1.2.3')).toBeTruthy()
  })

  it('osName/osVersion 为 null（设备不支持查询）：对应行整体缺席，其余行保留', () => {
    renderCard({ ...FULL_INFO, osName: null, osVersion: null })
    expect(screen.queryByText('Operating System')).toBeNull()
    expect(screen.queryByText('OS Version')).toBeNull()
    expect(screen.getByText('improv-test')).toBeTruthy()
    expect(screen.getByText('ESP32')).toBeTruthy()
  })

  it('osName/osVersion 为空字符串（字段缺失等价表达）：同样缺席', () => {
    renderCard({ ...FULL_INFO, osName: '', osVersion: '' })
    expect(screen.queryByText('Operating System')).toBeNull()
    expect(screen.queryByText('OS Version')).toBeNull()
  })
})
