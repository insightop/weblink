/// <reference types="vite/client" />

declare global {
  interface Navigator {
    serial?: Serial;
  }

  interface Serial {
    requestPort(options?: unknown): Promise<SerialPort>;
    getPorts(): Promise<SerialPort[]>;
    addEventListener(type: "connect" | "disconnect", listener: (event: Event) => void): void;
    removeEventListener(type: "connect" | "disconnect", listener: (event: Event) => void): void;
  }

  interface SerialPort {
    readable: ReadableStream<Uint8Array> | null;
    writable: WritableStream<Uint8Array> | null;
    open(options: SerialOptions): Promise<void>;
    close(): Promise<void>;
    forget?(): Promise<void>;
    getInfo(): { usbVendorId?: number; usbProductId?: number };
  }

  type SerialParity = "none" | "even" | "odd";
  type SerialFlowControl = "none" | "hardware";

  interface SerialOptions {
    baudRate: number;
    dataBits?: 7 | 8;
    stopBits?: 1 | 2;
    parity?: SerialParity;
    flowControl?: SerialFlowControl;
    bufferSize?: number;
  }
}

export {};
