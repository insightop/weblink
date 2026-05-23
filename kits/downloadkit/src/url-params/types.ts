/** URL query 参数键名（kebab-case）。 */
export const URL_PARAM_KEYS = {
  TARGET: "target",
  PROGRAMMER: "programmer",
  FIRMWARE: "firmware",
  ADDR: "addr",
  AUTO: "auto",
} as const;

export type UrlParamKey = (typeof URL_PARAM_KEYS)[keyof typeof URL_PARAM_KEYS];

/** 解析后的参数，所有值保持原始 string 形态。 */
export interface UrlParams {
  target?: string;
  programmer?: string;
  /** 以 `programmer_` 为前缀的参数，剥离前缀后放入此处 */
  pluginConfig: Record<string, string>;
  firmwareUrl?: string;
  firmwareAddr?: string;
  auto?: string;
}
