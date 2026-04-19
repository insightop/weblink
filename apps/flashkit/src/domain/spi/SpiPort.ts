/**
 * 抽象 SPI 端口（领域层）：与具体 USB 桥无关。
 * CH341 在电气上使用 LSB-first 位序，由适配器完成位翻转。
 */
export interface SpiPort {
  /** 单次事务：写入 `write` 字节并在同一 CS 周期内读取 `readLength` 个 MISO 字节（通常为 dummy 读） */
  transfer(write: Uint8Array, readLength: number): Promise<Uint8Array>;
}
