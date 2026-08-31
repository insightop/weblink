export interface OtaSessionOptions {
  timeouts?: Partial<{
    t1: number
    t3: number
    t4: number
    t5: number
    t6: number
    t7: number
  }>
  /** When truthy, send DISCONNECT instead of PROGRAM_RESET after programming. */
  bypassFirmwareStart?: number
  backdoorTimeoutMs?: number
  backdoorRetryIntervalMs?: number
}

export interface ProgramProgress {
  phase: 'connecting' | 'info_table' | 'erasing' | 'writing' | 'resetting'
  segmentIndex?: number
  segmentTotal?: number
  bytesProcessed?: number
  bytesTotal?: number
  percent?: number
  detail?: string
}
