import type { SerialSignals, SerialTransport } from '../../domain/transport'

export class WebSerialTransport implements SerialTransport {
  readonly name = 'web-serial'
  private _port: SerialPort

  constructor(port: SerialPort, private readonly baudRate = 115200) {
    this._port = port
  }

  get port(): SerialPort {
    return this._port
  }

  async open(): Promise<void> {
    if (this._port.readable && this._port.writable) return
    await this._port.open({ baudRate: this.baudRate })
  }

  async close(): Promise<void> {
    await this._port.close().catch(() => undefined)
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this._port.writable) throw new Error('Serial writable stream unavailable')
    const writer = this._port.writable.getWriter()
    try {
      await writer.write(data)
    } finally {
      writer.releaseLock()
    }
  }

  async read(size: number, timeoutMs = 1000): Promise<Uint8Array> {
    if (!this._port.readable) throw new Error('Serial readable stream unavailable')
    const reader = this._port.readable.getReader()
    const deadline = Date.now() + timeoutMs
    const chunks: number[] = []
    try {
      while (chunks.length < size) {
        if (Date.now() > deadline) throw new Error('Serial read timeout')
        const result = await reader.read()
        if (result.done) throw new Error('Serial closed')
        if (result.value) chunks.push(...result.value)
      }
      return Uint8Array.from(chunks.slice(0, size))
    } finally {
      reader.releaseLock()
    }
  }

  getPort(): SerialPort {
    return this._port
  }

  async setSignals(signals: SerialSignals): Promise<void> {
    await this._port.setSignals(signals)
  }
}
