/// <reference types="vite/client" />

// Web Bluetooth types are included in modern TS lib.dom.
// Web NFC types may be missing depending on TS version; define minimal shape for our usage.
declare global {
  // --- Web Bluetooth (minimal subset; some TS lib.dom builds omit these) ---
  type BluetoothServiceUUID = number | string;
  type BluetoothCharacteristicUUID = number | string;

  interface RequestDeviceOptions {
    filters?: Array<{
      services?: BluetoothServiceUUID[];
      name?: string;
      namePrefix?: string;
      manufacturerData?: unknown[];
      serviceData?: unknown[];
    }>;
    optionalServices?: BluetoothServiceUUID[];
    acceptAllDevices?: boolean;
  }

  interface BluetoothRemoteGATTServer {
    connected: boolean;
    getPrimaryServices(service?: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService[]>;
    getPrimaryService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>;
    disconnect(): void;
  }

  interface BluetoothRemoteGATTService {
    uuid: string;
    getCharacteristics(characteristic?: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic[]>;
    getCharacteristic(characteristic: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic>;
  }

  interface BluetoothRemoteGATTCharacteristic extends EventTarget {
    uuid: string;
    properties?: {
      read?: boolean;
      write?: boolean;
      notify?: boolean;
      indicate?: boolean;
      writeWithoutResponse?: boolean;
    };
    value?: DataView;
    readValue(): Promise<DataView>;
    writeValue(value: BufferSource): Promise<void>;
    writeValueWithoutResponse?(value: BufferSource): Promise<void>;
    startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
    stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
    addEventListener(
      type: "characteristicvaluechanged",
      listener: (this: BluetoothRemoteGATTCharacteristic, ev: Event) => unknown,
      options?: boolean | AddEventListenerOptions,
    ): void;
    removeEventListener(
      type: "characteristicvaluechanged",
      listener: (this: BluetoothRemoteGATTCharacteristic, ev: Event) => unknown,
      options?: boolean | EventListenerOptions,
    ): void;
  }

  interface BluetoothDevice extends EventTarget {
    id: string;
    name?: string;
    gatt?: {
      connected: boolean;
      connect(): Promise<BluetoothRemoteGATTServer>;
      disconnect(): void;
    };
  }

  interface Bluetooth {
    requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>;
  }

  interface Navigator {
    bluetooth: Bluetooth;
  }

  interface NDEFReadingEvent extends Event {
    message: NDEFMessage;
    serialNumber: string;
  }

  interface NDEFReader extends EventTarget {
    scan(options?: { signal?: AbortSignal }): Promise<void>;
    write(
      message:
        | NDEFMessageInit
        | string
        | {
            records: NDEFRecordInit[];
          },
      options?: { signal?: AbortSignal },
    ): Promise<void>;
    onreading: ((this: NDEFReader, ev: NDEFReadingEvent) => unknown) | null;
    onreadingerror: ((this: NDEFReader, ev: Event) => unknown) | null;
  }

  interface NDEFMessage {
    records: NDEFRecord[];
  }

  interface NDEFRecord {
    recordType: string;
    mediaType?: string;
    id?: string;
    data?: DataView;
    encoding?: string;
    lang?: string;
  }

  interface NDEFRecordInit {
    recordType: string;
    mediaType?: string;
    id?: string;
    data?: BufferSource | string;
    encoding?: string;
    lang?: string;
  }

  interface NDEFMessageInit {
    records: NDEFRecordInit[];
  }

  const NDEFReader: {
    prototype: NDEFReader;
    new (): NDEFReader;
  };
}

export {};

