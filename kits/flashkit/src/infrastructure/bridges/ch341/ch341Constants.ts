/** 与 flashrom `ch341a_spi.c` / WCH 文档对齐的命令常量 */

export const CH341_PACKET_LENGTH = 0x20;

export const CH341A_CMD_SPI_STREAM = 0xa8;

export const CH341A_CMD_I2C_STREAM = 0xaa;

export const CH341A_CMD_UIO_STREAM = 0xab;

export const CH341A_CMD_I2C_STM_SET = 0x60;

export const CH341A_CMD_I2C_STM_END = 0x00;

export const CH341A_CMD_I2C_STM_STA = 0x74;

export const CH341A_CMD_I2C_STM_STO = 0x75;

export const CH341A_CMD_I2C_STM_OUT = 0x80;

export const CH341A_CMD_I2C_STM_IN = 0xc0;

export const CH341A_CMD_UIO_STM_OUT = 0x80;

export const CH341A_CMD_UIO_STM_DIR = 0x40;

export const CH341A_CMD_UIO_STM_END = 0x20;

/** flashrom 默认：100kHz I²C 时钟配置位 */
export const CH341A_STM_I2C_100K = 0x01;
