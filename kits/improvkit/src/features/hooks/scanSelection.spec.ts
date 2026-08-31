import { describe, expect, it } from 'vitest'
import type { Ssid } from '../../domain/types'
import { droppedSsid, strongestSsid } from './scanSelection'

/**
 * scanSelection 纯函数契约（TDD 先于实现）：最强网络预选与选中网络的掉线回填
 * 逻辑抽为可独立单测的纯函数，供 hook / WifiForm 复用（design.md D15）。
 */

const NETWORKS: Ssid[] = [
  { name: 'home-5g', rssi: -42, secured: true },
  { name: 'guest', rssi: -67, secured: false },
]

describe('strongestSsid', () => {
  it('returns the SSID with the maximum RSSI', () => {
    // home-5g(-42) 比 guest(-67) 信号更强
    expect(strongestSsid(NETWORKS)).toEqual({
      name: 'home-5g',
      rssi: -42,
      secured: true,
    })
  })

  it('ignores the order and picks the max regardless of list position', () => {
    const reversed = [NETWORKS[1], NETWORKS[0]]
    expect(strongestSsid(reversed)).toEqual(NETWORKS[0])
  })

  it('returns null for empty / null / undefined list', () => {
    expect(strongestSsid([])).toBeNull()
    expect(strongestSsid(null)).toBeNull()
    expect(strongestSsid(undefined)).toBeNull()
  })

  it('returns the first candidate when RSSI ties', () => {
    const ties: Ssid[] = [
      { name: 'a', rssi: -50, secured: false },
      { name: 'b', rssi: -50, secured: true },
    ]
    // 并列时取先出现的（KISS：避免引入额外去重规则）
    expect(strongestSsid(ties)).toEqual(ties[0])
  })
})

describe('droppedSsid', () => {
  it('returns the selected SSID when it is missing from the latest list (需要回填)', () => {
    expect(droppedSsid('home-5g', NETWORKS)).toBeNull() // 仍在列表中
    expect(droppedSsid('old-network', NETWORKS)).toBe('old-network') // 已消失 → 回填
  })

  it('returns null when there is no current selection or it is blank', () => {
    expect(droppedSsid(undefined, NETWORKS)).toBeNull()
    expect(droppedSsid('', NETWORKS)).toBeNull()
  })

  it('returns null when there is no list to judge against (networks null/undefined)', () => {
    // 扫描不可用或尚未扫描时无法判定"掉线"，不回填
    expect(droppedSsid('home-5g', null)).toBeNull()
    expect(droppedSsid('home-5g', undefined)).toBeNull()
  })

  it('matches by exact name (同名网络以最新并入为准则)', () => {
    expect(droppedSsid('guest', [{ name: 'guest', rssi: -60, secured: false }])).toBeNull()
  })
})
