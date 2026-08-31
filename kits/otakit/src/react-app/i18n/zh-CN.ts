import { messages } from './en-US'

export const messagesZhCN: typeof messages = {
  ota: {
    title: 'OTA 升级工具',
    unsupported: '浏览器不支持 Web Serial，请使用 Chrome/Edge。',
    insecure: '需要安全上下文（HTTPS 或 localhost）。',
    selectPort: '选择串口',
    firmwareUrl: '固件 URL',
    downloadFirmware: '下载固件',
    uploadFirmware: '上传固件',
    start: '开始刷写',
    stage: {
      idle: '空闲',
      connecting: '连接中',
      programming: '编程中',
      resetting: '复位中',
      done: '完成',
      failed: '失败',
    },
    clearLog: '清空日志',
    error: {
      'xcp.connect_failed': 'XCP 连接失败：设备未进入 bootloader 模式',
      'info_table.rejected': 'Info table 检查失败：设备拒绝升级',
      'info_table.error': 'Info table 检查错误',
      'firmware.parse_failed': '固件解析失败：无有效数据',
      'firmware.no_segments': '固件解析失败：无有效数据段',
      'firmware.segment_missing': '获取 segment 失败',
      'erase.failed': '擦除失败',
      'write.failed': '写入失败',
    },
  },
}
