/** FTDI D2XX 风格厂商请求（公开文档）；用于 FT232H MPSSE。 */
export const FTDI_SIO_RESET = 0;
export const FTDI_SIO_SET_BITMODE = 11;

/** `SIO_RESET` 的 value：清 MPSSE 状态 */
export const FTDI_RESET_PURGE_RX = 1;
export const FTDI_RESET_PURGE_TX = 2;

/** MPSSE 命令（FTDI AN108 / AN135，命令字节为公开接口描述） */
export const MPSSE_SET_BITS_LOW = 0x80;
export const MPSSE_SET_BITS_HIGH = 0x83;
export const MPSSE_LOOPBACK_END = 0x85;
export const MPSSE_TCK_DIVISOR = 0x86;
export const MPSSE_DISABLE_CLK_DIV5 = 0x8a;
export const MPSSE_DISABLE_3_PHASE = 0x8d;
export const MPSSE_CLOCK_DATA_IN_OUT_MSB = 0x31;
