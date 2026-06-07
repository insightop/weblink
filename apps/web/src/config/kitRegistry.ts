export interface KitModule {
  App?: any
  EmbeddedPage?: any
  messages?: Record<string, any>
  messagesZhCN?: Record<string, any>
}

export interface KitConfig {
  id: string
  title: string
  description: string
  loader?: () => Promise<KitModule>
}

export const KIT_REGISTRY: KitConfig[] = [
  {
    id: "serialkit",
    title: "Serial Kit",
    description: "WebSerial 串口调试",
    loader: () => import("@weblink/serialkit"),
  },
  {
    id: "wirelesskit",
    title: "Wireless Kit",
    description: "Web Bluetooth / NFC",
    loader: () => import("@weblink/wirelesskit"),
  },
  {
    id: "downloadkit",
    title: "Download Kit",
    description: "固件下载与烧录",
    loader: () => import("@weblink/downloadkit"),
  },
  {
    id: "capturekit",
    title: "Capture Kit",
    description: "摄像头 / 麦克风 / 扬声器",
    loader: () => import("@weblink/capturekit"),
  },
  {
    id: "webrtckit",
    title: "WebRTC Kit",
    description: "WebRTC P2P / 信令调试",
    loader: () => import("@weblink/webrtckit"),
  },
  {
    id: "flashkit",
    title: "Flash Kit",
    description: "SPI NOR / I2C EEPROM 编程",
    loader: () => import("@weblink/flashkit"),
  },
  {
    id: "cankit",
    title: "CAN Kit",
    description: "slcan USB-CAN 调试",
    loader: () => import("@weblink/cankit"),
  },
  {
    id: "ipkit",
    title: "IP Kit",
    description: "HTTP / WebSocket / DoH 调试",
    loader: () => import("@weblink/ipkit"),
  },
  {
    id: "hidkit",
    title: "HID Kit",
    description: "HID 设备调试",
    loader: () => import("@weblink/hidkit"),
  },
  {
    id: "sensorkit",
    title: "Sensor Kit",
    description: "传感器调试",
    loader: () => import("@weblink/sensorkit"),
  },
  {
    id: "vkvmkit",
    title: "VKVM Kit",
    description: "VirtualKVM",
    loader: () => import("@weblink/vkvmkit"),
  },
  {
    id: "otakit",
    title: "OTA Kit",
    description: "OpenBLT 协议调试",
    loader: () => import("@weblink/otakit"),
  },
]

export function findKit(id: string): KitConfig | undefined {
  return KIT_REGISTRY.find((k) => k.id === id)
}
