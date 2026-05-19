/** CH341 SPI 位序：LSB first，与 flashrom `swap_byte` 一致 */
export function swapCh341SpiByte(x: number): number {
  let v = x & 0xff;
  v = ((v >> 1) & 0x55) | ((v << 1) & 0xaa);
  v = ((v >> 2) & 0x33) | ((v << 2) & 0xcc);
  v = ((v >> 4) & 0x0f) | ((v << 4) & 0xf0);
  return v & 0xff;
}
