/**
 * WCH UART ISP 命令码（与 ch32-rs/wchisp 及官方引导程序一致）。
 * @see https://github.com/ch32-rs/wchisp/blob/main/src/constants.rs
 */
export const WCH_ISP_COMMAND = {
  IDENTIFY: 0xa1,
  ISP_END: 0xa2,
  ISP_KEY: 0xa3,
  ERASE: 0xa4,
  PROGRAM: 0xa5,
  VERIFY: 0xa6,
  READ_CONFIG: 0xa7,
  WRITE_CONFIG: 0xa8,
  DATA_ERASE: 0xa9,
  DATA_PROGRAM: 0xaa,
  DATA_READ: 0xab,
  SET_BAUD: 0xc5,
} as const;

/** read_config 位掩码：与 wchisp CFG_MASK_ALL 一致 */
export const WCH_CFG_MASK_ALL = 0x1f;

export const WCH_ISP_CHUNK_SIZE = 56;

export const WCH_SECTOR_SIZE = 1024;

/** 串口帧：请求前缀 / 应答头 */
export const WCH_UART_REQ_PREFIX = new Uint8Array([0x57, 0xab]);
export const WCH_UART_RESP_MAGIC = new Uint8Array([0x55, 0xaa]);
