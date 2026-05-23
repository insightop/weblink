import { URL_PARAM_KEYS, type UrlParams } from "./types";

const PLUGIN_CONFIG_PREFIX = "programmer_";

function isKnownKey(key: string): key is (typeof URL_PARAM_KEYS)[keyof typeof URL_PARAM_KEYS] {
  return Object.values(URL_PARAM_KEYS).includes(key as any);
}

/** 解析 URL search string 为结构化 `UrlParams`。纯函数，无副作用。 */
export function parseUrlParams(search?: string): UrlParams {
  const params: UrlParams = { pluginConfig: {} };

  if (!search) return params;

  const clean = search.startsWith("?") ? search.slice(1) : search;
  const usp = new URLSearchParams(clean);

  for (const [key, value] of usp.entries()) {
    if (key.startsWith(PLUGIN_CONFIG_PREFIX)) {
      const fieldKey = key.slice(PLUGIN_CONFIG_PREFIX.length);
      if (fieldKey) params.pluginConfig[fieldKey] = value;
    } else if (isKnownKey(key)) {
      if (key === URL_PARAM_KEYS.TARGET) params.target = value;
      else if (key === URL_PARAM_KEYS.PROGRAMMER) params.programmer = value;
      else if (key === URL_PARAM_KEYS.FIRMWARE) params.firmwareUrl = value;
      else if (key === URL_PARAM_KEYS.ADDR) params.firmwareAddr = value;
      else if (key === URL_PARAM_KEYS.AUTO) params.auto = value;
    }
    // unknown keys silently ignored
  }

  return params;
}
