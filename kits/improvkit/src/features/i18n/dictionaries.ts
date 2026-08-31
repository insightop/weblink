/**
 * i18n 文案字典（features 层）：en-US 与 zh-CN 全部成对提供（dictionaries.spec.ts
 * 锁定键集合对等）。键用平铺 snake_case（`page.*` / `device_info.*` / `error.*`
 * 为既有带点分组键）；错误类别键固定为 `error.<CATEGORY>` 前缀，
 * 供上层以 `t('error.' + errorCategory)` 动态取词。REQUEST_CANCELLED 刻意
 * 不提供文案——UI 对其静默，不会走到查词。
 */
export const messages = {
  'en-US': {
    // 页面标题 / 描述（Improv Wi-Fi 配网）
    'page.title': 'Improv Wi-Fi Setup',
    'page.description': 'Connect your device to a Wi-Fi network using Improv',
    // 能力检测提示
    unsupported_browser: 'Web Serial is not supported in this browser. Please use Chrome or Edge.',
    insecure_context:
      'Serial ports require a secure context. Open this page over HTTPS or localhost.',
    // 流程文案
    connect_button: 'Connect Device',
    connecting: 'Connecting…',
    'device_info.name': 'Device Name',
    'device_info.firmware': 'Firmware',
    'device_info.version': 'Version',
    'device_info.chip_family': 'Chip Family',
    'device_info.os_name': 'Operating System',
    'device_info.os_version': 'OS Version',
    wifi_label: 'Wi-Fi Network',
    password_label: 'Password',
    show_password: 'Show password',
    hide_password: 'Hide password',
    manual_ssid_placeholder: 'Enter the Wi-Fi name manually',
    submit_wifi: 'Connect',
    scan: 'Scan',
    scan_refresh: 'Rescan',
    scan_empty: 'No networks found.',
    scan_scanning: 'Scanning for networks…',
    scan_backfill_hint:
      'The selected network is no longer available. You can enter it manually to retry.',
    scan_unavailable_hint: 'This device cannot scan for networks. Enter the Wi-Fi name manually.',
    reconnect: 'Reconnect Device',
    provisioning: 'Provisioning…',
    success_title: 'Provisioning Successful',
    visit_device: 'Visit Device',
    change_wifi: 'Change Wi-Fi',
    retry: 'Retry',
    close: 'Close',
    cancel: 'Cancel',
    // 控制台（ConsoleView）
    console_title: 'Serial Console',
    console_download: 'Download Logs',
    console_exit: 'Exit',
    console_disconnected: 'Terminal disconnected',
    console_reset: 'Reset Device',
    console_reset_failed: 'Reset failed',
    // 控制台入口（配网视图「日志与控制台」）
    console_open: 'Logs & Console',
    // 复位后设备重启、Improv 会话失效：提示用户重新连接
    console_reset_reconnect: 'Device reset. Reconnect to continue.',
    // 错误类别映射（REQUEST_CANCELLED 无文案，UI 静默）
    'error.NOT_IMPROV_DEVICE': 'This device is not an Improv device.',
    'error.DEVICE_WIFI_DISABLED': 'The device Wi-Fi is disabled. Enable it and try again.',
    'error.UNABLE_TO_CONNECT': 'Unable to connect to this Wi-Fi network.',
    'error.UNKNOWN_COMMAND': 'The device does not support this action.',
    'error.TIMEOUT': 'The operation timed out. Please retry.',
    'error.BAD_HOSTNAME': 'The hostname was rejected by the device.',
    'error.INVALID_PACKET': 'The device returned invalid data.',
    'error.DISCONNECTED': 'The connection to the device was lost.',
    'error.UNKNOWN_ERROR': 'An unknown error occurred.',
  },
  'zh-CN': {
    // 页面标题 / 描述（Improv Wi-Fi 配网）
    'page.title': 'Improv Wi-Fi 配网',
    'page.description': '通过 Improv 让设备接入 Wi-Fi 网络',
    // 能力检测提示
    unsupported_browser: '当前浏览器不支持 Web Serial，请使用 Chrome 或 Edge 打开此页面',
    insecure_context: '串口功能需要安全上下文，请通过 HTTPS 或 localhost 访问此页面',
    // 流程文案
    connect_button: '连接设备',
    connecting: '连接中…',
    'device_info.name': '设备名称',
    'device_info.firmware': '固件版本',
    'device_info.version': '版本',
    'device_info.chip_family': '芯片型号',
    'device_info.os_name': '操作系统',
    'device_info.os_version': '系统版本',
    wifi_label: 'Wi-Fi 网络',
    password_label: '密码',
    show_password: '显示密码',
    hide_password: '隐藏密码',
    manual_ssid_placeholder: '手动输入 Wi-Fi 名称',
    submit_wifi: '连接',
    scan: '扫描网络',
    scan_refresh: '重新扫描',
    scan_empty: '未发现网络',
    scan_scanning: '正在扫描网络…',
    scan_backfill_hint: '所选网络已不可用，可手动输入重试',
    scan_unavailable_hint: '设备不支持自动扫描，请手动输入 Wi-Fi 名称',
    reconnect: '重新连接设备',
    provisioning: '正在配网…',
    success_title: '配网成功',
    visit_device: '访问设备',
    change_wifi: '更换 Wi-Fi',
    retry: '重试',
    close: '关闭',
    cancel: '取消',
    // 控制台（ConsoleView）
    console_title: '串口控制台',
    console_download: '下载日志',
    console_exit: '退出',
    console_disconnected: '终端已断开',
    console_reset: '复位设备',
    console_reset_failed: '复位失败',
    // 控制台入口（配网视图「日志与控制台」）
    console_open: '日志与控制台',
    // 复位后设备重启、Improv 会话失效：提示用户重新连接
    console_reset_reconnect: '设备已复位，请重新连接以继续',
    // 错误类别映射（REQUEST_CANCELLED 无文案，UI 静默）
    'error.NOT_IMPROV_DEVICE': '该设备不是 Improv 设备',
    'error.DEVICE_WIFI_DISABLED': '设备 Wi-Fi 已被禁用，请启用后重试',
    'error.UNABLE_TO_CONNECT': '无法连接该 Wi-Fi 网络',
    'error.UNKNOWN_COMMAND': '设备不支持该操作',
    'error.TIMEOUT': '操作超时，请重试',
    'error.BAD_HOSTNAME': '主机名不被设备接受',
    'error.INVALID_PACKET': '设备返回了无效数据',
    'error.DISCONNECTED': '与设备的连接已断开',
    'error.UNKNOWN_ERROR': '发生未知错误',
  },
} as const
