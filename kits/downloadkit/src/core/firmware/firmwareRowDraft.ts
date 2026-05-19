/** 固件动态行草稿（UI 状态）；`rowId` 作为段键写入 `FirmwareSegmentPayload.slotId`。 */
export interface FirmwareRowDraft {
  rowId: string;
  file: File | null;
  addressStr: string;
  note?: string;
}

export function createFirmwareRow(partial?: Partial<Omit<FirmwareRowDraft, "rowId">>): FirmwareRowDraft {
  return {
    rowId: crypto.randomUUID(),
    file: null,
    addressStr: "",
    note: "",
    ...partial,
  };
}

export function createEmptyRows(count: number, defaultAddressHex?: number): FirmwareRowDraft[] {
  const addrStr =
    defaultAddressHex != null && Number.isFinite(defaultAddressHex) ? `0x${defaultAddressHex.toString(16)}` : "";
  return Array.from({ length: count }, () => createFirmwareRow({ addressStr: addrStr }));
}
