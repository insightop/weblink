import { describe, expect, it, vi } from 'vitest'
import { ImprovSerialMessageType } from 'improv-wifi-serial-sdk/dist/const.js'
import { decodeFrames, encodeFrame, FakeImprovPort, type DecodedFrame } from './fakeImprovDevice'

/**
 * FakeImprovDevice 测试替身的单测（TDD：先于实现编写，首次运行必须失败）。
 *
 * 帧线格式（与真实 SDK dist/serial.js 一致，勿改动）：
 * [0..5]=IMPROV [6]=版本1 [7]=类型 [8]=数据长度 [data] [校验和] [0x0A]
 * 校验和 = 除自身外全部字节之和 & 0xFF。
 */

/** 按长度前缀格式解出字符串：data = [command, totalLen, len, bytes..., ...] */
function decodePrefixedStrings(data: number[]): string[] {
  const decoder = new TextDecoder()
  const strings: string[] = []
  let idx = 2
  while (idx < data.length) {
    const len = data[idx]
    strings.push(decoder.decode(new Uint8Array(data.slice(idx + 1, idx + 1 + len))))
    idx += 1 + len
  }
  return strings
}

/** 把字符串编码为 UTF-8 字节数组（长度前缀记录的 payload 部分） */
const enc = (s: string): number[] => [...new TextEncoder().encode(s)]

/** 逐帧写入（与真实 SDK 每次 writePacketToStream 一帧的行为一致） */
async function writeFrames(port: FakeImprovPort, ...frames: Uint8Array[]): Promise<void> {
  const writer = port.writable.getWriter()
  for (const frame of frames) {
    await writer.write(frame)
  }
  writer.releaseLock()
}

/** 读取 readable 侧直到凑满 count 个帧（应答在写入时同步入队，超时兜底防挂死） */
async function readFrames(port: FakeImprovPort, count: number): Promise<DecodedFrame[]> {
  const reader = port.readable.getReader()
  const decoded: DecodedFrame[] = []
  const deadline = Date.now() + 1000
  while (decoded.length < count) {
    if (Date.now() > deadline) {
      throw new Error(`timed out waiting for ${count} frames; got ${decoded.length}`)
    }
    const { value, done } = await reader.read()
    if (done) {
      throw new Error(`readable closed after ${decoded.length} frames; wanted ${count}`)
    }
    decoded.push(...decodeFrames(value))
  }
  reader.releaseLock()
  return decoded
}

describe('encodeFrame', () => {
  it('produces exact bytes for a known client RPC request frame (incl. checksum)', () => {
    // REQUEST_CURRENT_STATE 请求帧的字节形态：
    // IMPROV(6) + 版本1 + 类型3(RPC) + 长度2 + 数据[2,0] + 校验和229 + 换行10
    const frame = encodeFrame(3, [2, 0])
    expect([...frame]).toEqual([73, 77, 80, 82, 79, 86, 1, 3, 2, 2, 0, 229, 10])
  })

  it('embeds a checksum matching an independent sum over the non-checksum bytes', () => {
    // 校验和公式独立于实现重新计算一遍，防止实现与测试共同漂移
    const frame = encodeFrame(1, [2])
    const bytes = [...frame]
    const expectedChecksum = bytes.slice(0, -2).reduce((sum, byte) => sum + byte, 0) & 0xff
    expect(bytes[bytes.length - 2]).toBe(expectedChecksum)
    expect(bytes[bytes.length - 1]).toBe(0x0a)
  })
})

describe('decodeFrames', () => {
  it('decodes a single well-formed frame', () => {
    expect(decodeFrames(encodeFrame(1, [2]))).toEqual([{ type: 1, data: [2] }])
  })

  it('decodes two coalesced frames from one byte stream (粘包)', () => {
    const joined = new Uint8Array([...encodeFrame(3, [2, 0]), ...encodeFrame(4, [4, 0])])
    expect(decodeFrames(joined)).toEqual([
      { type: 3, data: [2, 0] },
      { type: 4, data: [4, 0] },
    ])
  })

  it('skips noise bytes around a frame, flushing noise at newlines', () => {
    // 帧前 3 字节噪声 + 换行打断；帧后 9 字节非 IMPROV 噪声（触发噪声分支）以换行收尾
    const noiseBefore = [0x00, 0x1b, 0xff, 0x0a]
    const noiseAfter = [...'OKgarbage'].map((c) => c.charCodeAt(0)).concat(0x0a)
    const stream = [...noiseBefore, ...encodeFrame(1, [2]), ...noiseAfter]
    expect(decodeFrames(stream)).toEqual([{ type: 1, data: [2] }])
  })

  it('drops a frame whose checksum was corrupted', () => {
    const corrupted = Uint8Array.from(encodeFrame(1, [2]))
    corrupted[corrupted.length - 2] = (corrupted[corrupted.length - 2] + 1) & 0xff
    expect(decodeFrames(corrupted)).toEqual([])
  })

  it('does not emit a partially received frame (tail without checksum)', () => {
    // 去掉校验和与换行：剩余字节不足 10+N，必须保持未成帧状态（fake 靠此等后续写入补齐）
    const partial = encodeFrame(1, [2]).slice(0, -2)
    expect(decodeFrames(partial)).toEqual([])
  })

  it('round-trips length-prefixed UTF-8 strings (Chinese SSID) through encode+decode', () => {
    const ssid = '中文WiFi'
    const rssi = '-45'
    const secured = 'YES'
    const values: number[][] = [enc(ssid), enc(rssi), enc(secured)]
    const totalLen = values.reduce((sum, bytes) => sum + 1 + bytes.length, 0)
    const data = [4, totalLen, ...values.flatMap((bytes) => [bytes.length, ...bytes])]

    const [frame] = decodeFrames(encodeFrame(4, data))
    expect(frame).toEqual({ type: 4, data })
    // 长度前缀回解后应得到与写入完全一致的字符串（UTF-8 中文往返无损）
    expect(decodePrefixedStrings(frame.data)).toEqual([ssid, rssi, secured])
  })
})

describe('FakeImprovPort', () => {
  it('answers REQUEST_INFO with a RPC_RESULT frame preserving value order', async () => {
    const port = new FakeImprovPort({
      info: {
        firmware: 'fw-1.2.3',
        version: 'v9',
        chipFamily: 'ESP32-S3',
        name: '灯带',
        osName: 'Arduino',
        osVersion: '2.0.0',
      },
    })
    await writeFrames(port, encodeFrame(3, [3, 0]))

    const frames = await readFrames(port, 1)
    expect(frames[0].type).toBe(ImprovSerialMessageType.RPC_RESULT)
    expect(frames[0].data[0]).toBe(3)
    // 值序契约：firmware, version, chipFamily, name, osName, osVersion
    expect(decodePrefixedStrings(frames[0].data)).toEqual([
      'fw-1.2.3',
      'v9',
      'ESP32-S3',
      '灯带',
      'Arduino',
      '2.0.0',
    ])
  })

  it('reports the configured initialState on REQUEST_CURRENT_STATE', async () => {
    const port = new FakeImprovPort({ initialState: 3 })
    await writeFrames(port, encodeFrame(3, [2, 0]))
    const frames = await readFrames(port, 2)
    // CURRENT_STATE(data=[state]) + RPC_RESULT([2,0]) 回执内部 promise
    expect(frames).toEqual([
      { type: 1, data: [3] },
      { type: 4, data: [2, 0] },
    ])
  })

  it('answers every REQUEST_CURRENT_STATE retry (device boot retry loop)', async () => {
    const port = new FakeImprovPort() // initialState 默认 READY=2
    for (let i = 0; i < 3; i++) {
      await writeFrames(port, encodeFrame(3, [2, 0]))
    }
    const frames = await readFrames(port, 6)
    expect(frames).toEqual([
      { type: 1, data: [2] },
      { type: 4, data: [2, 0] },
      { type: 1, data: [2] },
      { type: 4, data: [2, 0] },
      { type: 1, data: [2] },
      { type: 4, data: [2, 0] },
    ])
  })

  it('streams scan results line-by-line then terminates with an empty result', async () => {
    const port = new FakeImprovPort({
      networks: [
        { name: '我的WiFi', rssi: -45, secured: true },
        { name: 'guest', rssi: -60, secured: false },
      ],
    })
    await writeFrames(port, encodeFrame(3, [4, 0]))

    const frames = await readFrames(port, 3)
    expect(frames[0].type).toBe(ImprovSerialMessageType.RPC_RESULT)
    expect(frames[0].data[0]).toBe(4)
    // totalLen = 三条长度前缀记录的总字节数（独立按线格式重新计算）
    const expectedTotal = ['我的WiFi', '-45', 'YES'].reduce(
      (sum, str) => sum + 1 + new TextEncoder().encode(str).length,
      0,
    )
    expect(frames[0].data[1]).toBe(expectedTotal)
    expect(decodePrefixedStrings(frames[0].data)).toEqual(['我的WiFi', '-45', 'YES'])
    expect(decodePrefixedStrings(frames[1].data)).toEqual(['guest', '-60', 'NO'])
    // 空 totalLen=0 的 RPC_RESULT 表示扫描结束
    expect(frames[2]).toEqual({ type: 4, data: [4, 0] })
  })

  it('answers scan unsupported with ERROR_STATE UNKNOWN_RPC_COMMAND', async () => {
    const port = new FakeImprovPort({ scanSupported: false })
    await writeFrames(port, encodeFrame(3, [4, 0]))
    const frames = await readFrames(port, 1)
    expect(frames).toEqual([{ type: 2, data: [2] }])
  })

  it('provisions ok: PROVISIONING → PROVISIONED → RPC_RESULT with nextUrl', async () => {
    const port = new FakeImprovPort({
      provisionOutcome: { kind: 'ok', nextUrl: 'https://example.com/setup' },
    })
    const ssid = enc('MyWiFi')
    const password = enc('secret123')
    await writeFrames(
      port,
      encodeFrame(3, [
        1,
        ssid.length + password.length,
        ssid.length,
        ...ssid,
        password.length,
        ...password,
      ]),
    )

    const frames = await readFrames(port, 3)
    expect(frames[0]).toEqual({ type: 1, data: [3] }) // PROVISIONING
    expect(frames[1]).toEqual({ type: 1, data: [4] }) // PROVISIONED
    expect(frames[2].type).toBe(ImprovSerialMessageType.RPC_RESULT)
    expect(frames[2].data[0]).toBe(1)
    expect(decodePrefixedStrings(frames[2].data)).toEqual(['https://example.com/setup'])
  })

  it('expresses a provision without next URL as an empty-string value', async () => {
    const port = new FakeImprovPort({ provisionOutcome: { kind: 'ok' } })
    const ssid = enc('a')
    await writeFrames(port, encodeFrame(3, [1, 1 + ssid.length, ssid.length, ...ssid]))

    const frames = await readFrames(port, 3)
    // 无 URL 时 RPC_RESULT data = [1, totalLen=1, len=0] → 空串值（非 undefined）
    expect(frames[2]).toEqual({ type: 4, data: [1, 1, 0] })
  })

  it('answers provision failure with ERROR_STATE UNABLE_TO_CONNECT', async () => {
    const port = new FakeImprovPort({ provisionOutcome: { kind: 'fail' } })
    const ssid = enc('MyWiFi')
    await writeFrames(port, encodeFrame(3, [1, 1 + ssid.length, ssid.length, ...ssid]))
    const frames = await readFrames(port, 1)
    expect(frames).toEqual([{ type: 2, data: [3] }])
  })

  it('stays silent in silent mode (simulating a non-Improv device)', async () => {
    const port = new FakeImprovPort({ silent: true })
    await writeFrames(port, encodeFrame(3, [2, 0]))

    // 有界沉默断言：应答会在 writeFrames 内同步入队，read 的 resolve 是微任务。
    // 用 vi.waitFor 的轮询窗口代替裸 setTimeout 竞速——窗口内出现任何应答都会让
    // 取反条件立即可判定失败；waitFor 耗尽窗口后 reject，据此断言「始终无应答」
    let gotData = false
    const reader = port.readable.getReader()
    void reader
      .read()
      .then(({ done, value }) => {
        if (!done && value) gotData = true
      })
      .catch(() => {}) // releaseLock 会以 TypeError reject 挂起的 read，属预期
    await expect(
      vi.waitFor(
        () => {
          // 条件刻意取反：静默期内恒不成立 → waitFor 轮询直到窗口耗尽
          expect(gotData).toBe(true)
        },
        { timeout: 50, interval: 5 },
      ),
    ).rejects.toThrow()
    reader.releaseLock()
  })

  it('terminates the readable stream on triggerDisconnect (SDK read loop ends)', async () => {
    const port = new FakeImprovPort()
    const reader = port.readable.getReader()
    port.triggerDisconnect()
    const { done } = await reader.read()
    expect(done).toBe(true)
    reader.releaseLock()
  })

  it('records every command frame received from the client', async () => {
    const port = new FakeImprovPort()
    await writeFrames(port, encodeFrame(3, [2, 0]), encodeFrame(3, [3, 0]))
    expect(port.receivedFrames).toEqual([
      { type: 3, data: [2, 0] },
      { type: 3, data: [3, 0] },
    ])
  })
})
