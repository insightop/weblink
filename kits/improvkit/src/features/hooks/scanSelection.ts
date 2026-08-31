import type { Ssid } from '../../domain/types'

/**
 * 网络选择帮助的纯函数（design.md D15：预选/回填逻辑抽为纯函数可单测）。
 * 本模块不依赖任何框架运行时，hook 与 UI 复用同一份判定逻辑。
 */

/**
 * 挑出信号最强的网络（RSSI 最大）。
 * 空/ null / undefined 列表返回 null；RSSI 并列时取先出现的（KISS）。
 * 用于网络列表首次就绪时的默认预选。
 */
export function strongestSsid(networks: Ssid[] | null | undefined): Ssid | null {
  if (!networks || networks.length === 0) return null
  return networks.reduce(
    (best, current) => (current.rssi > best.rssi ? current : best),
    networks[0],
  )
}

/**
 * 判定当前选中的网络是否已从最新扫描列表消失，返回应回填的 SSID 名（或 null）。
 * 当无当前选择 / 选择为空白 / 列表不可判（null 或 undefined）时返回 null——
 * 扫描不可用或尚未扫描时无法判定"掉线"，不回填。同名匹配（扫描结果按名合并）。
 */
export function droppedSsid(
  selectedSsid: string | undefined,
  networks: Ssid[] | null | undefined,
): string | null {
  const selection = selectedSsid?.trim()
  if (!selection) return null
  if (!networks) return null
  if (networks.some((network) => network.name === selection)) return null
  return selection
}
