export interface Transport {
  readonly name: string
  open(): Promise<void>
  close(): Promise<void>
  write(data: Uint8Array): Promise<void>
  read(size: number, timeoutMs?: number): Promise<Uint8Array>
}

export interface SerialSignals {
  dataTerminalReady?: boolean
  requestToSend?: boolean
  break?: boolean
}

export interface SerialTransport extends Transport {
  getPort(): SerialPort
  setSignals(signals: SerialSignals): Promise<void>
}

export interface UsbTransport extends Transport {
  getDevice(): USBDevice
}
