import { URL_PARAM_KEYS, type OtaTimeouts, type UrlParams } from "./types";

const KNOWN = new Set<string>(Object.values(URL_PARAM_KEYS));

function toNumber(v: string | undefined): number | undefined {
  if (v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

export function parseUrlParams(search?: string): UrlParams {
  const params: UrlParams = { protocol: "mb-rtu", auto: false };
  if (!search) return params;
  const clean = search.startsWith("?") ? search.slice(1) : search;
  const usp = new URLSearchParams(clean);
  const timeouts: OtaTimeouts = {};

  for (const [key, value] of usp.entries()) {
    if (!KNOWN.has(key)) continue;
    switch (key) {
      case URL_PARAM_KEYS.SLAVE_ID:
        params.slaveId = toNumber(value);
        break;
      case URL_PARAM_KEYS.BAUD_RATE:
        params.baudrate = toNumber(value);
        break;
      case URL_PARAM_KEYS.FIRMWARE:
        params.firmwareUrl = value;
        break;
      case URL_PARAM_KEYS.AUTO:
        params.auto = value === "1" || value === "true";
        break;
      case URL_PARAM_KEYS.BYPASS_FIRMWARE_START:
        params.bypassFirmwareStart = toNumber(value);
        break;
      case URL_PARAM_KEYS.TIMEOUT_T1:
        timeouts.t1 = toNumber(value);
        break;
      case URL_PARAM_KEYS.TIMEOUT_T3:
        timeouts.t3 = toNumber(value);
        break;
      case URL_PARAM_KEYS.TIMEOUT_T4:
        timeouts.t4 = toNumber(value);
        break;
      case URL_PARAM_KEYS.TIMEOUT_T5:
        timeouts.t5 = toNumber(value);
        break;
      case URL_PARAM_KEYS.TIMEOUT_T6:
        timeouts.t6 = toNumber(value);
        break;
      case URL_PARAM_KEYS.TIMEOUT_T7:
        timeouts.t7 = toNumber(value);
        break;
    }
  }
  if (Object.keys(timeouts).length > 0) params.timeouts = timeouts;
  return params;
}
