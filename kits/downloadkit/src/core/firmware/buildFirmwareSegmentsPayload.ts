import type { FirmwareSegmentsPayload, FirmwareSegmentPayload } from "@/core/types/download";
import { parseIntelHex } from "@/shared/firmware/hex";
import type { ChipFamily, FirmwareInputPolicy } from "@/plugins/types";
import { parseHexAddressString, resolveDynamicFirmwareAddress } from "@/core/firmware/resolveSegmentAddresses";
import type { FirmwareRowDraft } from "@/core/firmware/firmwareRowDraft";

export interface BuildFirmwareSegmentsOptions {
  chipFamily: ChipFamily;
  policy: FirmwareInputPolicy;
  rows: FirmwareRowDraft[];
}

interface PreparedRow {
  row: FirmwareRowDraft;
  isHex: boolean;
  data: Uint8Array;
  hexBaseAddr: number | null;
}

/**
 * 从动态行草稿构建 `kind: "segments"` 载荷（供 `getInput()` 使用）。
 */
export async function buildFirmwareSegmentsPayload(options: BuildFirmwareSegmentsOptions): Promise<FirmwareSegmentsPayload> {
  const { chipFamily, policy, rows } = options;
  const prepared: PreparedRow[] = [];

  for (const row of rows) {
    const file = row.file;
    if (!file) continue;

    const lower = file.name.toLowerCase();
    if (lower.endsWith(".elf")) {
      throw new Error("ELF_NOT_IMPLEMENTED");
    }

    let data: Uint8Array;
    let hexBaseAddr: number | null = null;
    const isHex = lower.endsWith(".hex");
    if (isHex) {
      const text = await file.text();
      const parsed = parseIntelHex(text);
      data = parsed.bytes;
      hexBaseAddr = parsed.baseAddr;
    } else {
      data = new Uint8Array(await file.arrayBuffer());
    }

    prepared.push({ row, isHex, data, hexBaseAddr });
  }

  if (prepared.length === 0) {
    throw new Error("NO_FIRMWARE_SEGMENTS");
  }
  if (prepared.length < policy.minRows) {
    throw new Error("MIN_ROWS_NOT_MET");
  }

  const multi = prepared.length > 1;
  if (multi) {
    if (policy.hexFilePolicy === "disallowMultiRow" && prepared.some((p) => p.isHex)) {
      throw new Error("HEX_NOT_ALLOWED_MULTI_SLOT");
    }
    if (policy.hexFilePolicy === "firstRowOnly") {
      prepared.forEach((p, i) => {
        if (p.isHex && i !== 0) {
          throw new Error("HEX_NOT_ALLOWED_MULTI_SLOT");
        }
      });
    }
  }

  const items: FirmwareSegmentPayload[] = [];

  for (const p of prepared) {
    const { row } = p;
    const file = row.file!;
    const userAddress =
      policy.addressUserEditable && policy.showAddressColumn ? parseHexAddressString(row.addressStr) : null;
    const address = resolveDynamicFirmwareAddress({
      policy,
      chipFamily,
      hexBaseAddr: p.hexBaseAddr,
      userAddress,
    });
    const noteTrim = row.note?.trim();
    items.push({
      slotId: row.rowId,
      address,
      data: p.data,
      label: noteTrim || file.name,
      note: noteTrim || undefined,
    });
  }

  return { kind: "segments", items };
}
