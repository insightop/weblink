/**
 * 在这里维护可内嵌的 kit 地址（固定配置）。
 * 说明：目标站点必须允许被 iframe 嵌入（CSP frame-ancestors / X-Frame-Options）。
 */
export const KIT_MODULES = [
  {
    key: 'serialkit',
    name: 'Serial Kit',
    desc: 'WebSerial 串口调试工具',
    url: 'https://serialkit.pages.dev',
  },
  {
    key: 'modbuskit',
    name: 'Modbus Kit',
    desc: 'Modbus 调试与常用功能面板',
    url: 'https://modbuskit.pages.dev',
  },
  {
    key: 'gnsskit',
    name: 'GNSS Kit',
    desc: 'GNSS/NMEA 数据查看与分析',
    url: 'https://gnsskit.pages.dev',
  },
  {
    key: 'capturekit',
    name: 'Capture Kit',
    desc: '摄像头 / 麦克风 / 扬声器调试',
    url: 'https://capturekit.pages.dev',
  },
  {
    key: 'downloadkit',
    name: 'Download Kit',
    desc: '下载与资源管理工具',
    url: 'https://weblink-downloadkit.pages.dev',
  },
]
