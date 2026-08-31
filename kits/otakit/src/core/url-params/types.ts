export const URL_PARAM_KEYS = {
  PROTOCOL: "protocol",
  SLAVE_ID: "slaveId",
  BAUD_RATE: "baudrate",
  FIRMWARE: "firmware",
  AUTO: "auto",
  TIMEOUT_T1: "timeoutT1",
  TIMEOUT_T3: "timeoutT3",
  TIMEOUT_T4: "timeoutT4",
  TIMEOUT_T5: "timeoutT5",
  TIMEOUT_T6: "timeoutT6",
  TIMEOUT_T7: "timeoutT7",
  BYPASS_FIRMWARE_START: "bypassFirmwareStart",
} as const;

export interface OtaTimeouts {
  t1?: number;
  t3?: number;
  t4?: number;
  t5?: number;
  t6?: number;
  t7?: number;
}

export interface UrlParams {
  protocol: "mb-rtu";
  slaveId?: number;
  baudrate?: number;
  firmwareUrl?: string;
  auto: boolean;
  timeouts?: OtaTimeouts;
  bypassFirmwareStart?: number;
}
