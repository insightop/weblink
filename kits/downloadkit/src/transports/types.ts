export interface Transport {
  readonly name: string;
  selectDevice?(): Promise<void>;
  isDeviceReady?(): boolean;
  getDeviceLabel?(): string | null;
  getDeviceDetails?(): string[];
  releaseSession?(): Promise<void>;
  open(): Promise<void>;
  close(): Promise<void>;
  write(data: Uint8Array): Promise<void>;
  read(size: number, timeoutMs?: number): Promise<Uint8Array>;
  flush?(): Promise<void>;
  cancel?(): Promise<void>;
}

export interface SerialSignals {
  dataTerminalReady?: boolean;
  requestToSend?: boolean;
  break?: boolean;
}

export interface SerialTransport extends Transport {
  getPort(): SerialPort;
  setSignals(signals: SerialSignals): Promise<void>;
}

export interface UsbTransport extends Transport {
  getDevice(): USBDevice;
}

export interface TransportFactoryContext {
  baudRate?: number;
  usbDevice?: USBDevice;
  hidDevice?: HIDDevice;
}
