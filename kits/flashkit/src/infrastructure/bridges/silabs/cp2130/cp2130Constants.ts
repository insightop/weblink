/**
 * CP2130 USB 厂商请求与 Bulk SPI 帧（参考 Silicon Labs 数据手册与 Apache-2 参考实现中的公开字段布局）。
 * Bulk 前缀 8 字节：`[0..1]=0`、`[2]=TransferCommand`、`[3]=0`、`[4..7]=小端长度`。
 */
export const CP2130_TRANSFER_READ = 0x00;
export const CP2130_TRANSFER_WRITE = 0x01;
export const CP2130_TRANSFER_WRITE_READ = 0x02;

export enum Cp2130VendorCommand {
  SetSpiWord = 0x31,
  SetGpioChipSelect = 0x25,
  SetSpiDelay = 0x33,
  GetReadOnlyVersion = 0x11,
}

/** 时钟分频档位（与常见开源驱动枚举一致，低 3 位写入 SPI Word 寄存器） */
export const CP2130_SPI_CLOCK_3MHZ = 2;
