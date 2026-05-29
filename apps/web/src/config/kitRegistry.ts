export interface KitConfig {
  id: string
  title: string
  description: string
  stack: "vue" | "js" | "svelte"
  /** 生产部署 URL（iframe 兜底用） */
  prodUrl: string
  /** 本地开发端口 */
  localPort?: number
}

export const KIT_REGISTRY: KitConfig[] = [
  {
    id: "serialkit",
    title: "Serial Kit",
    description: "WebSerial 串口调试",
    stack: "vue",
    prodUrl: "https://serialkit.pages.dev",
    localPort: 5174,
  },
  {
    id: "wirelesskit",
    title: "Wireless Kit",
    description: "Web Bluetooth / NFC",
    stack: "vue",
    prodUrl: "https://wirelesskit.pages.dev",
    localPort: 5175,
  },
  {
    id: "downloadkit",
    title: "Download Kit",
    description: "固件下载与烧录",
    stack: "vue",
    prodUrl: "https://weblink-downloadkit.pages.dev",
    localPort: 5176,
  },
  {
    id: "capturekit",
    title: "Capture Kit",
    description: "摄像头 / 麦克风 / 扬声器",
    stack: "vue",
    prodUrl: "https://capturekit.pages.dev",
    localPort: 5177,
  },
  {
    id: "gnsskit",
    title: "GNSS Kit",
    description: "GNSS / NMEA 数据分析",
    stack: "js",
    prodUrl: "https://gnsskit.pages.dev",
    localPort: 5178,
  },
  {
    id: "modbuskit",
    title: "Modbus Kit",
    description: "Modbus 调试面板",
    stack: "svelte",
    prodUrl: "https://modbuskit.pages.dev",
    localPort: 5179,
  },
  {
    id: "webrtckit",
    title: "WebRTC Kit",
    description: "WebRTC P2P / 信令调试",
    stack: "vue",
    prodUrl: "https://webrtckit.pages.dev",
    localPort: 5180,
  },
  {
    id: "flashkit",
    title: "Flash Kit",
    description: "SPI NOR / I2C EEPROM 编程",
    stack: "vue",
    prodUrl: "https://weblink-flashkit.pages.dev",
    localPort: 5181,
  },
  {
    id: "cankit",
    title: "CAN Kit",
    description: "slcan USB-CAN 调试",
    stack: "vue",
    prodUrl: "https://cankit.pages.dev",
    localPort: 5182,
  },
  {
    id: "ipkit",
    title: "IP Kit",
    description: "HTTP / WebSocket / DoH 调试",
    stack: "vue",
    prodUrl: "https://ipkit.pages.dev",
    localPort: 5183,
  },
  {
    id: "hidkit",
    title: "HID Kit",
    description: "HID 设备调试 (placeholder)",
    stack: "vue",
    prodUrl: "",
  },
  {
    id: "sensorkit",
    title: "Sensor Kit",
    description: "传感器调试 (placeholder)",
    stack: "vue",
    prodUrl: "",
  },
  {
    id: "vkvmkit",
    title: "VKVM Kit",
    description: "VirtualKVM (placeholder)",
    stack: "vue",
    prodUrl: "",
  },
  {
    id: "otakit",
    title: "OTA Kit",
    description: "OpenBLT 协议调试",
    stack: "vue",
    prodUrl: "",
    localPort: 5184,
  },
]

export function findKit(id: string): KitConfig | undefined {
  return KIT_REGISTRY.find((k) => k.id === id)
}
