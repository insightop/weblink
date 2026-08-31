import type { SerialPort } from '@insightop/libopenblt'

/**
 * Adapt a "frame transactor" (send a complete frame, await the response) to
 * the byte-level {@link SerialPort} interface required by libopenblt.
 *
 * The transactor performs Modbus RTU framing, CRC and XCP request/response on
 * top of the raw link, so this adapter only needs to buffer the single
 * response produced by `transact` and hand it out byte-by-byte via `read`.
 */
export function createSerialPortAdapter(
  transact: (frame: Uint8Array, timeoutMs?: number) => Promise<Uint8Array>,
): SerialPort {
  let responseBuffer: Uint8Array = new Uint8Array(0)
  return {
    async open() {
      return true
    },
    close() {},
    async write(data: Uint8Array): Promise<boolean> {
      const response = await transact(data)
      responseBuffer = response
      return true
    },
    async read(length: number): Promise<Uint8Array> {
      if (responseBuffer.length === 0) return new Uint8Array(0)
      const chunk = responseBuffer.slice(0, length)
      responseBuffer = responseBuffer.slice(length)
      return chunk
    },
  }
}
