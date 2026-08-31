import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  bltSessionInit,
  bltSessionStart,
  bltSessionStop,
  bltSessionTerminate,
  bltSessionCheckInfoTable,
  bltSessionClearMemory,
  bltSessionWriteData,
  bltFirmwareInit,
  bltFirmwareTerminate,
  bltFirmwareLoadFromFile,
  bltFirmwareGetSegmentCount,
  bltFirmwareGetSegment,
  HexParser,
  BLT_SESSION_XCP_V10,
  BLT_TRANSPORT_XCP_V10_MBRTU,
  BLT_RESULT_OK,
  BLT_RESULT_ERROR_SESSION_INFO_TABLE,
  BLT_RESULT_ERROR_GENERIC,
} from '@insightop/libopenblt'
import { OtaSession } from './otaSession'
import type { ProgramProgress } from './otaSession.types'

// Real constants are preserved via importActual; only functions are stubbed.
vi.mock('@insightop/libopenblt', async (importActual) => {
  const actual = await importActual<typeof import('@insightop/libopenblt')>()
  return {
    ...actual,
    bltSessionInit: vi.fn(),
    bltSessionStart: vi.fn(),
    bltSessionStop: vi.fn(),
    bltSessionTerminate: vi.fn(),
    bltSessionCheckInfoTable: vi.fn(),
    bltSessionClearMemory: vi.fn(),
    bltSessionWriteData: vi.fn(),
    bltFirmwareInit: vi.fn(),
    bltFirmwareTerminate: vi.fn(),
    bltFirmwareLoadFromFile: vi.fn(),
    bltFirmwareGetSegmentCount: vi.fn(),
    bltFirmwareGetSegment: vi.fn(),
  }
})

type BltSessionInitArgs = [
  sessionType: number,
  sessionSettings: Record<string, unknown>,
  transportType: number,
  transportSettings: Record<string, unknown>,
]

function initArgs(): BltSessionInitArgs | undefined {
  return (bltSessionInit as ReturnType<typeof vi.fn>).mock.calls?.[0] as
    | BltSessionInitArgs
    | undefined
}

const transact = async (): Promise<Uint8Array> => new Uint8Array(0)

describe('OtaSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('connect succeeds and configures transport with baudrate/slaveId/parity/stopbits', async () => {
    vi.mocked(bltSessionStart).mockResolvedValue(BLT_RESULT_OK)
    vi.mocked(bltSessionCheckInfoTable).mockResolvedValue(BLT_RESULT_OK)

    const session = new OtaSession(transact, 7, 115200)
    await expect(session.connect()).resolves.toBeUndefined()

    expect(bltSessionInit).toHaveBeenCalledTimes(1)
    const [, sessionSettings, transportType, transportSettings] = initArgs()!
    expect(bltSessionInit).toHaveBeenCalledWith(
      BLT_SESSION_XCP_V10,
      expect.anything(),
      BLT_TRANSPORT_XCP_V10_MBRTU,
      expect.anything(),
    )
    expect(sessionSettings).toMatchObject({ bypassFirmwareStart: 0 })
    expect(transportType).toBe(BLT_TRANSPORT_XCP_V10_MBRTU)
    expect(transportSettings).toMatchObject({
      baudrate: 115200,
      destinationAddr: 7,
      parity: 0,
      stopbits: 1,
    })
    expect(bltSessionStart).toHaveBeenCalledTimes(1)
    session.close()
  })

  it('connect retries backdoor until bltSessionStart succeeds', async () => {
    const attempts = vi
      .fn()
      .mockResolvedValueOnce(BLT_RESULT_ERROR_GENERIC)
      .mockResolvedValueOnce(BLT_RESULT_ERROR_GENERIC)
      .mockResolvedValue(BLT_RESULT_OK)
    vi.mocked(bltSessionStart).mockImplementation(attempts)
    vi.mocked(bltSessionCheckInfoTable).mockResolvedValue(BLT_RESULT_OK)

    const session = new OtaSession(transact, 1, 9600, {
      backdoorTimeoutMs: 50,
      backdoorRetryIntervalMs: 5,
    })
    await expect(session.connect()).resolves.toBeUndefined()
    // connect succeeded → at least one retry happened after the two non-OK attempts
    expect(attempts.mock.calls.length).toBeGreaterThan(2)
    // the last call must have returned OK (connect only resolves on OK)
    expect(vi.mocked(bltSessionStart).mock.calls.length).toBeGreaterThanOrEqual(3)
    session.close()
  })

  it('connect throws when bltSessionStart never succeeds', async () => {
    vi.mocked(bltSessionStart).mockResolvedValue(BLT_RESULT_ERROR_GENERIC)

    const session = new OtaSession(transact, 1, 9600, {
      backdoorTimeoutMs: 30,
      backdoorRetryIntervalMs: 5,
    })
    await expect(session.connect()).rejects.toThrow('xcp.connect_failed')
    session.close()
  })

  it('connect throws when info table rejects the upgrade', async () => {
    vi.mocked(bltSessionStart).mockResolvedValue(BLT_RESULT_OK)
    vi.mocked(bltSessionCheckInfoTable).mockResolvedValue(BLT_RESULT_ERROR_SESSION_INFO_TABLE)

    const session = new OtaSession(transact, 1, 9600)
    await expect(session.connect()).rejects.toThrow('info_table.rejected')
    session.close()
  })

  it('program parses firmware and reports erasing + writing progress', async () => {
    vi.mocked(bltFirmwareLoadFromFile).mockReturnValue(true)
    vi.mocked(bltFirmwareGetSegmentCount).mockReturnValue(1)
    const seg = { address: 0x08000000, len: 512, data: new Uint8Array(512) }
    vi.mocked(bltFirmwareGetSegment).mockImplementation((i: number) => (i === 0 ? seg : null))
    vi.mocked(bltSessionClearMemory).mockResolvedValue(BLT_RESULT_OK)
    vi.mocked(bltSessionWriteData).mockResolvedValue(BLT_RESULT_OK)

    const onProgress = vi.fn<(p: ProgramProgress) => void>()
    const session = new OtaSession(transact, 1, 9600)
    await expect(session.program('hex', onProgress)).resolves.toBeUndefined()

    expect(bltFirmwareInit).toHaveBeenCalledWith(HexParser)
    expect(bltFirmwareGetSegment).toHaveBeenCalledWith(0)
    expect(bltSessionClearMemory).toHaveBeenCalledWith(0x08000000, 512)
    expect(bltSessionWriteData).toHaveBeenCalledWith(0x08000000, 256, expect.any(Uint8Array))

    const events = onProgress.mock.calls.map(([p]: [ProgramProgress]) => p)
    expect(events.filter((p) => p.phase === 'erasing').length).toBeGreaterThan(0)
    expect(events.filter((p) => p.phase === 'writing').length).toBeGreaterThan(0)
    // erase is one chunk (512 <= 32k) so percent=100; write is 256+256 halves
    const writing = events.filter((p) => p.phase === 'writing')
    expect(writing.at(-1)!.percent).toBe(100)
    expect(bltFirmwareTerminate).toHaveBeenCalled()
    session.close()
  })

  it('program throws when firmware file cannot be parsed', async () => {
    vi.mocked(bltFirmwareLoadFromFile).mockReturnValue(false)

    const session = new OtaSession(transact, 1, 9600)
    await expect(session.program('bad')).rejects.toThrow('firmware.parse_failed')
    expect(bltFirmwareTerminate).toHaveBeenCalled()
    session.close()
  })

  it('reset calls bltSessionStop', async () => {
    vi.mocked(bltSessionStop).mockResolvedValue(undefined)
    const session = new OtaSession(transact, 1, 9600)
    await expect(session.reset()).resolves.toBeUndefined()
    expect(bltSessionStop).toHaveBeenCalledTimes(1)
    session.close()
  })

  it('close terminates both session and firmware', () => {
    const session = new OtaSession(transact, 1, 9600)
    session.close()
    expect(bltSessionTerminate).toHaveBeenCalledTimes(1)
    expect(bltFirmwareTerminate).toHaveBeenCalledTimes(1)
  })
})
