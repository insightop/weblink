import type { FirmwareRowDraft } from "@/core/firmware/firmwareRowDraft";
import type { PersistedFirmwareRow } from "@/features/flasher/persistence/schema";

export function toPersistedFirmwareRows(rows: FirmwareRowDraft[]): PersistedFirmwareRow[] {
  return rows.map((row) => ({
    rowId: row.rowId,
    addressStr: row.addressStr,
    note: row.note ?? "",
    file: row.file
      ? {
          name: row.file.name,
          type: row.file.type,
          size: row.file.size,
          lastModified: row.file.lastModified,
          blob: row.file,
        }
      : null,
  }));
}

export function fromPersistedFirmwareRows(rows: PersistedFirmwareRow[]): FirmwareRowDraft[] {
  return rows.map((row) => ({
    rowId: row.rowId,
    addressStr: row.addressStr,
    note: row.note ?? "",
    file: row.file
      ? new File([row.file.blob], row.file.name, {
          type: row.file.type,
          lastModified: row.file.lastModified,
        })
      : null,
  }));
}
