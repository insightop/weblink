/** Linux include/uapi/linux/can.h 中与 gs_usb 帧内 can_id 一致的标志 */
export const CAN_EFF_FLAG = 0x8000_0000;
export const CAN_RTR_FLAG = 0x4000_0000;
export const CAN_ERR_FLAG = 0x2000_0000;
export const CAN_EFF_MASK = 0x1fff_ffff;

/** struct gs_host_frame 经典 CAN、无硬件时间戳时的字节长度 */
export const GS_HOST_FRAME_SIZE = 20;

/** echo_id：接收帧为 -1（0xffffffff） */
export const GS_USB_RX_ECHO_ID = 0xffff_ffff;

/** gs_usb_breq（与 mainline 内核 / 常见 candleLight 固件一致） */
export const GS_USB_BREQ_HOST_FORMAT = 0;
export const GS_USB_BREQ_BITTIMING = 1;
export const GS_USB_BREQ_MODE = 2;
export const GS_USB_BREQ_BT_CONST = 4;
export const GS_USB_BREQ_DEVICE_CONFIG = 5;

export const GS_CAN_MODE_RESET = 0;
export const GS_CAN_MODE_START = 1;

/** struct gs_device_mode::flags 常用位 */
export const GS_CAN_MODE_NORMAL = 0;

/** USB 控制传输 bmRequestType：vendor, device, host-to-device */
export const GS_USB_REQ_OUT = 0x41;

/** USB 控制传输 bmRequestType：vendor, device, device-to-host */
export const GS_USB_REQ_IN = 0xc1;
