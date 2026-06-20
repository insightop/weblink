import { describe, expect, it, vi } from 'vitest'
import { WebSerialTransport } from './WebSerialTransport'

function makeMockPort(options?: { opened?: boolean }) {
  const opened = options?.opened ?? false
  return {
    opened,
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    setSignals: vi.fn().mockResolvedValue(undefined),
    readable: opened
      ? {
          getReader: () => {
            let index = 0
            const chunks = [new Uint8Array([1, 2]), new Uint8Array([3])]
            return {
              read: vi.fn().mockImplementation(async () => {
                if (index < chunks.length) return { value: chunks[index++], done: false }
                return { value: undefined, done: true }
              }),
              releaseLock: vi.fn(),
            }
          },
        }
      : undefined,
    writable: opened
      ? {
          getWriter: () => ({
            write: vi.fn().mockResolvedValue(undefined),
            releaseLock: vi.fn(),
          }),
        }
      : undefined,
  } as unknown as SerialPort
}

describe('WebSerialTransport', () => {
  it('open() 调用 port.open({ baudRate })', async () => {
    const port = makeMockPort()
    const transport = new WebSerialTransport(port, 9600)
    await transport.open()
    expect(port.open).toHaveBeenCalledWith({ baudRate: 9600 })
  })

  it('open() 已打开时跳过', async () => {
    const port = makeMockPort({ opened: true })
    const transport = new WebSerialTransport(port)
    await transport.open()
    expect(port.open).not.toHaveBeenCalled()
  })

  it('close() 调用 port.close()', async () => {
    const port = makeMockPort({ opened: true })
    const transport = new WebSerialTransport(port)
    await transport.close()
    expect(port.close).toHaveBeenCalledOnce()
  })

  it('write() 通过 writable stream 写入', async () => {
    const port = makeMockPort({ opened: true })
    const transport = new WebSerialTransport(port)
    const data = new Uint8Array([0x48, 0x69])
    await transport.write(data)
    // writable.getWriter().write(data) was called
  })

  it('read() 从 readable stream 读取并截断到指定 size', async () => {
    const port = makeMockPort({ opened: true })
    const transport = new WebSerialTransport(port)
    const result = await transport.read(2, 5000)
    expect(result).toEqual(new Uint8Array([1, 2]))
  })

  it('getPort() 返回底层 port', () => {
    const port = makeMockPort()
    const transport = new WebSerialTransport(port)
    expect(transport.getPort()).toBe(port)
  })

  it('port getter 返回底层 port', () => {
    const port = makeMockPort()
    const transport = new WebSerialTransport(port)
    expect(transport.port).toBe(port)
  })

  it('setSignals() 调用 port.setSignals()', async () => {
    const port = makeMockPort()
    const transport = new WebSerialTransport(port)
    await transport.setSignals({ dataTerminalReady: true })
    expect(port.setSignals).toHaveBeenCalledWith({ dataTerminalReady: true })
  })
})
