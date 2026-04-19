import type { ChipFamily, FirmwareInputPolicy } from "@/plugins/types";

/** 解析 UI 中的地址字符串（支持 `0x` 前缀或纯十六进制）。无效时返回 `null`。 */
export function parseHexAddressString(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (trimmed === "") return null;
  const withoutPrefix = trimmed.startsWith("0x") || trimmed.startsWith("0X") ? trimmed.slice(2) : trimmed;
  const n = parseInt(withoutPrefix, 16);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * 合并 Intel HEX 基址、用户覆盖与策略默认地址（动态行，无固定槽位）。
 * 顺序：用户覆盖（可编辑时）> HEX 基址 > `defaultAppAddress` / 芯片族默认。
 */
export function resolveDynamicFirmwareAddress(params: {
  policy: FirmwareInputPolicy;
  chipFamily: ChipFamily;
  hexBaseAddr: number | null;
  userAddress: number | null;
}): number {
  const { policy, chipFamily, hexBaseAddr, userAddress } = params;
  const fallback =
    policy.defaultAppAddress ?? (chipFamily === "esp32" ? 0x10000 : 0x0800_0000);

  if (policy.addressUserEditable && userAddress !== null) {
    return userAddress;
  }
  if (!policy.addressUserEditable && hexBaseAddr !== null) {
    return hexBaseAddr;
  }
  if (hexBaseAddr !== null) {
    return hexBaseAddr;
  }
  if (policy.addressUserEditable && userAddress === null) {
    return fallback;
  }
  return fallback;
}
