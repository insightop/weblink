import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocaleContext } from './i18n/useI18n'
import { OtaPage } from './OtaPage'

// ---- 打桩 useOtaSession：捕获 start 的入参，由测试驱动状态机 ----
const ota = vi.hoisted(() => ({
  state: { active: false, stage: 'idle', percent: 0 } as {
    active: boolean
    stage: string
    percent: number
  },
  start: vi.fn(),
  reset: vi.fn(),
}))

vi.mock('./hooks/useOtaSession', () => ({ useOtaSession: () => ota }))

// ---- 打桩固件获取：避免真实网络 ----
vi.mock('../core/firmware/firmwareFetcher', () => ({
  fetchFirmwareFromUrl: vi.fn(async () => ':020000040000FA\n:00000001FF\n'),
  readFirmwareFile: vi.fn(async (f: File) => `HEX:${f.name}`),
}))

import { fetchFirmwareFromUrl } from '../core/firmware/firmwareFetcher'

const mockFetchFirmware = vi.mocked(fetchFirmwareFromUrl)

/** 构造一个可直接 read/write 的假 SerialPort（Web Serial 形态） */
function createFakePort(response: Uint8Array) {
  const written: number[][] = []
  const opened: Array<{ baudRate: number }> = []
  let readCount = 0
  return {
    written,
    opened,
    port: {
      open: async (opts: { baudRate: number }) => {
        opened.push(opts)
      },
      writable: {
        getWriter: () => ({
          write: async (d: Uint8Array) => {
            written.push(Array.from(d))
          },
          releaseLock: () => {},
        }),
      },
      readable: {
        getReader: () => ({
          read: async () => {
            if (readCount++ === 0) return { done: false as const, value: response }
            return { done: true as const, value: undefined }
          },
          releaseLock: () => {},
        }),
      },
    },
  }
}

/** 构造一个 read 永不 resolve 的假 SerialPort（模拟设备静默） */
function createSilentPort() {
  return {
    port: {
      open: async () => {},
      writable: {
        getWriter: () => ({
          write: async () => {},
          releaseLock: () => {},
        }),
      },
      readable: {
        getReader: () => ({
          // 永不 resolve/reject：等同设备对某帧始终不回复
          read: () => new Promise<never>(() => {}),
          releaseLock: () => {},
        }),
      },
    },
  }
}

/** 让 OtaPage 走正常渲染分支：stub 能力检测 */
function stubCapabilities(port: unknown) {
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
  Object.defineProperty(navigator, 'serial', {
    value: {
      requestPort: vi.fn().mockResolvedValue(port),
      getPorts: vi.fn(),
    },
    configurable: true,
  })
}

const RESPONSE = new Uint8Array([0x01, 0x6d, 0x03, 0xff, 0x00, 0x00, 0x00, 0x00])

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  window.history.replaceState({}, '', '/')
})

describe('OtaPage 数据流集成', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('URL 参数预填：firmwareUrl 进入固件输入框，slaveId/baudrate 进入 start', async () => {
    window.history.replaceState(
      {},
      '',
      '/?slaveId=5&baudrate=57600&firmware=https%3A%2F%2Fx%2Fapp.hex',
    )
    const { port, written } = createFakePort(RESPONSE)
    stubCapabilities(port)
    // 让 start 立即消费 transact，便于断言真实读写
    ota.start.mockImplementation(
      async (opts: { transact?: (f: Uint8Array, t?: number) => Promise<Uint8Array> }) => {
        if (opts.transact) await opts.transact(new Uint8Array([0x11]))
      },
    )

    render(
      <LocaleContext.Provider value="zh-CN">
        <OtaPage />
      </LocaleContext.Provider>,
    )

    // 固件 URL 预填
    expect((screen.getByPlaceholderText('固件 URL') as HTMLInputElement).value).toBe(
      'https://x/app.hex',
    )

    // 选中串口
    fireEvent.click(screen.getByRole('button', { name: '选择串口' }))

    // 手动模式：预填 URL 即固件地址，点「下载固件」填充 hex，等待 start 按钮可点后再点
    fireEvent.click(screen.getByRole('button', { name: '下载固件' }))
    const startBtn = screen.getByRole('button', { name: '开始刷写' }) as HTMLButtonElement
    await waitFor(() => expect(startBtn.disabled).toBe(false), { timeout: 3000 })
    fireEvent.click(startBtn)
    await waitFor(() => expect(ota.start).toHaveBeenCalled(), { timeout: 3000 })

    const opts = ota.start.mock.calls[0][0] as { slaveId: number; baudrate: number }
    expect(opts.slaveId).toBe(5)
    expect(opts.baudrate).toBe(57600)
    // transact 真实写入了帧
    expect(written).toEqual([[17]])
  })

  it('transact 前先 port.open({ baudRate })，且同一 port 只 open 一次', async () => {
    window.history.replaceState({}, '', '/?baudrate=57600&firmware=https%3A%2F%2Fx%2Fapp.hex')
    const { port, opened } = createFakePort(RESPONSE)
    stubCapabilities(port)
    ota.start.mockImplementation(
      async (opts: { transact?: (f: Uint8Array, t?: number) => Promise<Uint8Array> }) => {
        if (opts.transact) await opts.transact(new Uint8Array([0x11]))
      },
    )

    render(
      <LocaleContext.Provider value="zh-CN">
        <OtaPage />
      </LocaleContext.Provider>,
    )
    fireEvent.click(screen.getByRole('button', { name: '选择串口' }))
    fireEvent.click(screen.getByRole('button', { name: '下载固件' }))
    const startBtn = screen.getByRole('button', { name: '开始刷写' }) as HTMLButtonElement
    await waitFor(() => expect(startBtn.disabled).toBe(false), { timeout: 3000 })
    fireEvent.click(startBtn)
    await waitFor(() => expect(ota.start).toHaveBeenCalled(), { timeout: 3000 })

    // 用户选择的 baudrate 应用到物理链路
    expect(opened).toEqual([{ baudRate: 57600 }])

    // 再次 start：同一 port 不重复 open
    fireEvent.click(startBtn)
    await waitFor(() => expect(ota.start).toHaveBeenCalledTimes(2), { timeout: 3000 })
    expect(opened).toEqual([{ baudRate: 57600 }])
  })

  it('固件 URL 下载后 hex 进入 start（mock fetchFirmwareFromUrl）', async () => {
    window.history.replaceState({}, '', '/?firmware=https%3A%2F%2Fx%2Fapp.hex')
    const { port } = createFakePort(RESPONSE)
    stubCapabilities(port)
    ota.start.mockImplementation(async () => {})

    render(
      <LocaleContext.Provider value="zh-CN">
        <OtaPage />
      </LocaleContext.Provider>,
    )
    fireEvent.click(screen.getByRole('button', { name: '选择串口' }))

    // 输入 URL 并点「下载固件」
    const input = screen.getByPlaceholderText('固件 URL') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'https://example.com/a.hex' } })
    fireEvent.click(screen.getByRole('button', { name: '下载固件' }))

    await waitFor(() => expect(mockFetchFirmware).toHaveBeenCalledWith('https://example.com/a.hex'))
    fireEvent.click(screen.getByRole('button', { name: '开始刷写' }))
    await waitFor(() => expect(ota.start).toHaveBeenCalled(), { timeout: 3000 })
    const opts = ota.start.mock.calls[0][0] as { hexData: string }
    expect(opts.hexData).toBe(':020000040000FA\n:00000001FF\n')
  })

  it('auto=1 + 固件 URL + 选中串口后自动触发刷写', async () => {
    window.history.replaceState({}, '', '/?auto=1&firmware=https%3A%2F%2Fx%2Fapp.hex&slaveId=2')
    const { port } = createFakePort(RESPONSE)
    stubCapabilities(port)
    ota.start.mockImplementation(async () => {})

    render(
      <LocaleContext.Provider value="zh-CN">
        <OtaPage />
      </LocaleContext.Provider>,
    )

    // 挂载后自动下载 hex
    await waitFor(() => expect(mockFetchFirmware).toHaveBeenCalledWith('https://x/app.hex'))

    // 选中串口 → 应自动触发 start（无需手动点开始）
    fireEvent.click(screen.getByRole('button', { name: '选择串口' }))
    await waitFor(() => expect(ota.start).toHaveBeenCalled())
    const opts = ota.start.mock.calls[0][0] as { hexData: string; slaveId: number }
    expect(opts.slaveId).toBe(2)
    expect(opts.hexData).toBeTruthy()
  })

  it('transact 真实读写 port.writable/port.readable 字节流', async () => {
    const frame = new Uint8Array([0x01, 0x6d, 0x02, 0xff, 0x00, 0x00, 0x00])
    const response = new Uint8Array([0x01, 0x6d, 0x03, 0xaa, 0xbb, 0xcc, 0xdd, 0xee])
    const { written, port } = createFakePort(response)
    stubCapabilities(port)
    ota.start.mockImplementation(
      async (opts: { transact?: (f: Uint8Array, t?: number) => Promise<Uint8Array> }) => {
        if (opts.transact) await opts.transact(frame)
      },
    )

    render(
      <LocaleContext.Provider value="zh-CN">
        <OtaPage />
      </LocaleContext.Provider>,
    )
    fireEvent.click(screen.getByRole('button', { name: '选择串口' }))

    // 需要 hexData 才能触发 start
    const input = screen.getByPlaceholderText('固件 URL') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'https://example.com/app.hex' } })
    fireEvent.click(screen.getByRole('button', { name: '下载固件' }))
    await waitFor(() => expect(mockFetchFirmware).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: '开始刷写' }))
    await waitFor(() => expect(ota.start).toHaveBeenCalled(), { timeout: 3000 })

    // 写入的是完整帧
    expect(written).toEqual([Array.from(frame)])
  })

  it('start 按钮在未选 port/固件时 disabled', async () => {
    stubCapabilities(undefined)
    render(
      <LocaleContext.Provider value="zh-CN">
        <OtaPage />
      </LocaleContext.Provider>,
    )
    const btn = screen.getByRole('button', { name: '开始刷写' })
    expect((btn as HTMLButtonElement).disabled).toBe(true)
  })

  it('设备静默（read 永不 resolve）时 transact 在 timeout 后返回而非挂死', async () => {
    const { port } = createSilentPort()
    stubCapabilities(port)

    // 捕获 handleStart 内的 transact，直接触发以断言超时行为
    let capturedTransact: null | ((frame: Uint8Array, timeoutMs?: number) => Promise<Uint8Array>) =
      null
    ota.start.mockImplementation(
      (opts: { transact?: (frame: Uint8Array, timeoutMs?: number) => Promise<Uint8Array> }) => {
        if (opts.transact) capturedTransact = opts.transact
        return Promise.resolve(undefined)
      },
    )

    render(
      <LocaleContext.Provider value="zh-CN">
        <OtaPage />
      </LocaleContext.Provider>,
    )
    fireEvent.click(screen.getByRole('button', { name: '选择串口' }))
    const input = screen.getByPlaceholderText('固件 URL') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'https://example.com/app.hex' } })
    fireEvent.click(screen.getByRole('button', { name: '下载固件' }))
    await waitFor(() => expect(mockFetchFirmware).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: '开始刷写' }))
    await waitFor(() => expect(ota.start).toHaveBeenCalled())

    expect(capturedTransact).toBeTruthy()

    // 用短 timeout(如 30ms) 触发：必须返回而非永久 pending
    const frame = new Uint8Array([0x01, 0x6d, 0x02, 0xff, 0x00, 0x00, 0x00])
    const startedAt = Date.now()
    const result = await capturedTransact!(frame, 30)
    const elapsed = Date.now() - startedAt

    // 超时后返回（可能为空字节），且不会无限挂起
    expect(result).toBeInstanceOf(Uint8Array)
    expect(elapsed).toBeLessThan(1000)
  })
})
