import type { BridgeBackendId, BusKind, MatrixCell } from "@/matrix/types";

/** 用户可见的「编程器/模块」选项（不暴露 vendor、WebUSB/WebHID 等技术细节） */
export const WORKBENCH_ADAPTER_OPTIONS = [
  { id: "ch341", label: "CH341A 编程器" },
  { id: "ft232h", label: "FT232H 模块" },
  { id: "cp2130", label: "CP2130 模块" },
  { id: "cp2112", label: "CP2112 模块" },
] as const;

export type WorkbenchAdapterId = (typeof WORKBENCH_ADAPTER_OPTIONS)[number]["id"];

const ADAPTER_TO_BRIDGE: Record<WorkbenchAdapterId, BridgeBackendId> = {
  ch341: "ch341-vendor-bulk",
  ft232h: "ftdi-mpsse-ft232h",
  cp2130: "silabs-cp2130-hid",
  cp2112: "silabs-cp2112-hid",
};

export function bridgeIdForAdapter(adapterId: WorkbenchAdapterId): BridgeBackendId {
  return ADAPTER_TO_BRIDGE[adapterId];
}

export function resolveMatrixCell(
  cells: readonly MatrixCell[],
  adapterId: WorkbenchAdapterId,
  bus: BusKind,
): MatrixCell | undefined {
  const bid = ADAPTER_TO_BRIDGE[adapterId];
  return cells.find((c) => c.bridgeBackendId === bid && c.bus === bus);
}

export function adapterSupportsBusInCells(
  cells: readonly MatrixCell[],
  adapterId: WorkbenchAdapterId,
  bus: BusKind,
): boolean {
  return resolveMatrixCell(cells, adapterId, bus) !== undefined;
}
