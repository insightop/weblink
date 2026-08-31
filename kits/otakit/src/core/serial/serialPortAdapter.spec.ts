import { describe, it, expect, vi } from 'vitest'
import { SerialPortBaudrate, SerialPortParity, SerialPortStopbits } from '@insightop/libopenblt'
import { createSerialPortAdapter } from './serialPortAdapter'

describe('createSerialPortAdapter', () => {
  it('write calls transact and caches response', async () => {
    const transact = vi.fn(async () => new Uint8Array([0x01, 0x02, 0x03]))
    const port = createSerialPortAdapter(transact)
    expect(
      await port.open(
        'x',
        SerialPortBaudrate.BR9600,
        SerialPortParity.NONE,
        SerialPortStopbits.ONE,
      ),
    ).toBe(true)
    expect(await port.write(new Uint8Array([0xaa]))).toBe(true)
    expect(transact).toHaveBeenCalledTimes(1)
    const chunk = await port.read(2)
    expect(Array.from(chunk)).toEqual([0x01, 0x02])
  })

  it('read returns remaining bytes across calls', async () => {
    const transact = vi.fn(async () => new Uint8Array([0x01, 0x02, 0x03]))
    const port = createSerialPortAdapter(transact)
    await port.write(new Uint8Array([0xaa]))
    const a = await port.read(2)
    const b = await port.read(10)
    expect(Array.from(a)).toEqual([0x01, 0x02])
    expect(Array.from(b)).toEqual([0x03])
  })

  it('read returns empty when no response cached', async () => {
    const port = createSerialPortAdapter(async () => new Uint8Array())
    const chunk = await port.read(1)
    expect(chunk.length).toBe(0)
  })
})
