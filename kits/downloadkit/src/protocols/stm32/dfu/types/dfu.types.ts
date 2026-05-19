export interface DfuInterfaceInfo {
  configurationValue: number;
  interfaceNumber: number;
  alternateSetting: number;
  interfaceProtocol: number;
  interfaceName: string | null;
}

export interface DfuseSector {
  start: number;
  end: number;
  sectorSize: number;
  readable: boolean;
  erasable: boolean;
  writable: boolean;
}

export interface DfuseMemoryDescriptor {
  name: string;
  segments: DfuseSector[];
}

export interface DfuseDownloadOptions {
  startAddress: number;
  data: Uint8Array;
  transferSize: number;
  onProgress: (writtenBytes: number, totalBytes: number) => void;
}

export interface DfuStatus {
  status: number;
  pollTimeout: number;
  state: number;
  iString: number;
}

export const DFU_REQUEST = {
  DETACH: 0x00,
  DNLOAD: 0x01,
  UPLOAD: 0x02,
  GETSTATUS: 0x03,
  CLRSTATUS: 0x04,
  GETSTATE: 0x05,
  ABORT: 0x06,
} as const;

export const DFU_STATE = {
  APP_IDLE: 0,
  APP_DETACH: 1,
  DFU_IDLE: 2,
  DFU_DNLOAD_SYNC: 3,
  DFU_DNBUSY: 4,
  DFU_DNLOAD_IDLE: 5,
  DFU_MANIFEST_SYNC: 6,
  DFU_MANIFEST: 7,
  DFU_MANIFEST_WAIT_RESET: 8,
  DFU_UPLOAD_IDLE: 9,
  DFU_ERROR: 10,
} as const;

export const DFU_STATUS_OK = 0x00;

export const DFUSE_COMMAND = {
  GET_COMMANDS: 0x00,
  SET_ADDRESS: 0x21,
  ERASE_SECTOR: 0x41,
} as const;
