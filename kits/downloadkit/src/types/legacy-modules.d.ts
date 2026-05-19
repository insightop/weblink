declare module "../../../../../uart_isp.js" {
  class UARTISP {
    open(port: SerialPort): Promise<void>;
    close(): Promise<void>;
    handshake(maxRetries?: number): Promise<void>;
    getChipId(maxRetries?: number): Promise<Uint8Array>;
    eraseAll(): Promise<void>;
    downloadBin(
      arrayBuffer: ArrayBuffer,
      baseAddress: number,
      progressCallback?: (written: number, total: number) => void,
    ): Promise<void>;
  }
  export default UARTISP;
}

declare module "../../../../uart_isp.js" {
  class UARTISP {
    open(port: SerialPort): Promise<void>;
    close(): Promise<void>;
    handshake(maxRetries?: number): Promise<void>;
    getChipId(maxRetries?: number): Promise<Uint8Array>;
    eraseAll(): Promise<void>;
    downloadBin(
      arrayBuffer: ArrayBuffer,
      baseAddress: number,
      progressCallback?: (written: number, total: number) => void,
    ): Promise<void>;
  }
  export default UARTISP;
}

declare module "../../../../vendor/protocols/webstlink/src/webstlink.js" {
  export default class WebStlink {
    constructor(logger?: unknown);
    attach(device: USBDevice): Promise<void>;
    detect_cpu(expectedCpus: string[], pickCpu?: (candidates: unknown[]) => Promise<string | null>): Promise<unknown>;
    flash(address: number, data: Uint8Array): Promise<void>;
    reset(halt: boolean): Promise<void>;
    detach(): Promise<void>;
  }
}

declare module "../../../vendor/protocols/webstlink/src/webstlink.js" {
  export default class WebStlink {
    constructor(logger?: unknown);
    attach(device: USBDevice): Promise<void>;
    detect_cpu(expectedCpus: string[], pickCpu?: (candidates: unknown[]) => Promise<string | null>): Promise<unknown>;
    flash(address: number, data: Uint8Array): Promise<void>;
    reset(halt: boolean): Promise<void>;
    detach(): Promise<void>;
  }
}

declare module "../../../../vendor/protocols/webstlink/src/lib/package.js" {
  export class Logger {
    static usb?: { filters?: USBDeviceFilter[] };
    constructor(level?: number, context?: unknown);
  }
}

declare module "../../../vendor/protocols/webstlink/src/lib/package.js" {
  export class Logger {
    static usb?: { filters?: USBDeviceFilter[] };
    constructor(level?: number, context?: unknown);
  }
}

interface HIDDeviceFilter {
  vendorId?: number;
  productId?: number;
  usagePage?: number;
  usage?: number;
}

interface HID {
  requestDevice(options: { filters: HIDDeviceFilter[] }): Promise<HIDDevice[]>;
}

interface HIDDevice {
  open(): Promise<void>;
  close(): Promise<void>;
}

interface Navigator {
  hid: HID;
}
