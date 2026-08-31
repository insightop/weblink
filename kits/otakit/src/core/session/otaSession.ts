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
  BLT_RESULT_ERROR_SESSION_INFO_TABLE_NOT_SUPPORTED,
  type SerialPort,
} from '@insightop/libopenblt'
import { createSerialPortAdapter } from '../serial/serialPortAdapter'
import { OtaError } from './otaSession.errors'
import type { OtaSessionOptions, ProgramProgress } from './otaSession.types'

const ERASE_CHUNK_SIZE = 32 * 1024
const WRITE_CHUNK_SIZE = 256
const DEFAULT_BACKDOOR_TIMEOUT_MS = 10_000
const DEFAULT_BACKDOOR_RETRY_INTERVAL_MS = 100

export class OtaSession {
  private readonly serialPort: SerialPort
  private readonly slaveId: number
  private readonly baudrate: number
  private readonly options: Required<
    Pick<OtaSessionOptions, 'backdoorTimeoutMs' | 'backdoorRetryIntervalMs'>
  > &
    OtaSessionOptions

  constructor(
    transact: (frame: Uint8Array, timeoutMs?: number) => Promise<Uint8Array>,
    slaveId: number,
    baudrate: number,
    options?: OtaSessionOptions,
  ) {
    this.slaveId = slaveId
    this.baudrate = baudrate
    this.options = {
      backdoorTimeoutMs: options?.backdoorTimeoutMs ?? DEFAULT_BACKDOOR_TIMEOUT_MS,
      backdoorRetryIntervalMs:
        options?.backdoorRetryIntervalMs ?? DEFAULT_BACKDOOR_RETRY_INTERVAL_MS,
      ...options,
    }
    this.serialPort = createSerialPortAdapter(transact)
  }

  async connect(): Promise<void> {
    const bypassFirmwareStart = this.options.bypassFirmwareStart ?? 0
    bltSessionInit(
      BLT_SESSION_XCP_V10,
      {
        timeoutT1: this.options.timeouts?.t1 ?? 1000,
        timeoutT3: this.options.timeouts?.t3 ?? 2000,
        timeoutT4: this.options.timeouts?.t4 ?? 10000,
        timeoutT5: this.options.timeouts?.t5 ?? 1000,
        timeoutT6: this.options.timeouts?.t6 ?? 50,
        timeoutT7: this.options.timeouts?.t7 ?? 2000,
        seedKeyAlgorithm: undefined,
        connectMode: 0,
        bypassFirmwareStart,
      },
      BLT_TRANSPORT_XCP_V10_MBRTU,
      {
        serialPort: this.serialPort,
        portName: 'modbus',
        baudrate: this.baudrate,
        parity: 0,
        stopbits: 1,
        destinationAddr: this.slaveId,
      },
    )

    let startResult = await bltSessionStart()
    if (startResult !== BLT_RESULT_OK) {
      const retryDeadline = Date.now() + this.options.backdoorTimeoutMs
      while (Date.now() < retryDeadline) {
        await new Promise((r) => setTimeout(r, this.options.backdoorRetryIntervalMs))
        startResult = await bltSessionStart()
        if (startResult === BLT_RESULT_OK) break
      }
      if (startResult !== BLT_RESULT_OK) {
        throw new OtaError('xcp.connect_failed')
      }
    }

    const infoResult = await bltSessionCheckInfoTable()
    if (infoResult === BLT_RESULT_ERROR_SESSION_INFO_TABLE) {
      throw new OtaError('info_table.rejected')
    }
    if (
      infoResult !== BLT_RESULT_OK &&
      infoResult !== BLT_RESULT_ERROR_SESSION_INFO_TABLE_NOT_SUPPORTED
    ) {
      throw new OtaError('info_table.error', String(infoResult))
    }
  }

  async program(hexData: string, onProgress?: (p: ProgramProgress) => void): Promise<void> {
    bltFirmwareInit(HexParser)
    try {
      const loadOk = bltFirmwareLoadFromFile(hexData, 0)
      if (!loadOk) throw new OtaError('firmware.parse_failed')
      const segCount = bltFirmwareGetSegmentCount()
      if (segCount === 0) throw new OtaError('firmware.no_segments')
      const totalSize = this.computeTotalSize(segCount)

      let totalErased = 0
      for (let i = 0; i < segCount; i++) {
        const seg = bltFirmwareGetSegment(i)
        if (!seg) throw new OtaError('firmware.segment_missing', String(i))
        let remaining = seg.len
        let addr = seg.address
        while (remaining > 0) {
          const chunk = Math.min(remaining, ERASE_CHUNK_SIZE)
          const result = await bltSessionClearMemory(addr, chunk)
          if (result !== BLT_RESULT_OK) throw new OtaError('erase.failed', `0x${addr.toString(16)}`)
          addr += chunk
          remaining -= chunk
          totalErased += chunk
          onProgress?.({
            phase: 'erasing',
            segmentIndex: i,
            segmentTotal: segCount,
            bytesProcessed: totalErased,
            bytesTotal: totalSize,
            percent: Math.round((totalErased / totalSize) * 100),
          })
        }
      }

      let totalWritten = 0
      for (let i = 0; i < segCount; i++) {
        const seg = bltFirmwareGetSegment(i)
        if (!seg) throw new OtaError('firmware.segment_missing', String(i))
        let remaining = seg.len
        let addr = seg.address
        let offset = 0
        while (remaining > 0) {
          const chunk = Math.min(remaining, WRITE_CHUNK_SIZE)
          const chunkData = seg.data.subarray(offset, offset + chunk)
          const result = await bltSessionWriteData(addr, chunk, chunkData)
          if (result !== BLT_RESULT_OK) throw new OtaError('write.failed', `0x${addr.toString(16)}`)
          addr += chunk
          offset += chunk
          remaining -= chunk
          totalWritten += chunk
          onProgress?.({
            phase: 'writing',
            segmentIndex: i,
            segmentTotal: segCount,
            bytesProcessed: totalWritten,
            bytesTotal: totalSize,
            percent: Math.round((totalWritten / totalSize) * 100),
          })
        }
      }
    } finally {
      bltFirmwareTerminate()
    }
  }

  async reset(): Promise<void> {
    await bltSessionStop()
  }

  close(): void {
    bltSessionTerminate()
    bltFirmwareTerminate()
  }

  private computeTotalSize(segCount: number): number {
    let total = 0
    for (let i = 0; i < segCount; i++) {
      const seg = bltFirmwareGetSegment(i)
      if (seg) total += seg.len
    }
    return total || 1
  }
}
