import type { FirmwareInputPolicy } from "@/plugins/types";

/**
 * 预设策略说明见 {@link FirmwareInputPolicy} 字段注释与真值表。
 *
 * STM32 串口 / USB DFU：单行；第二列展示默认/解析地址（禁用编辑），实际烧录地址仍由 HEX 内嵌或 `defaultAppAddress` 决定。
 */
export const stm32FixedAddressPolicy: FirmwareInputPolicy = {
  minRows: 1,
  maxRows: 1,
  defaultRows: 1,
  addressUserEditable: false,
  showAddressColumn: true,
  hexFilePolicy: "allow",
  defaultAppAddress: 0x0800_0000,
};

/** STM32 ST-Link / DAP-Link：单行，可选手动烧录起始地址。 */
export const stm32UserAddressPolicy: FirmwareInputPolicy = {
  minRows: 1,
  maxRows: 1,
  defaultRows: 1,
  addressUserEditable: true,
  showAddressColumn: true,
  hexFilePolicy: "allow",
  defaultAppAddress: 0x0800_0000,
};

/** ESP32 串口：多行，按用户填写的烧录地址组合镜像。 */
export const esp32SerialPolicy: FirmwareInputPolicy = {
  minRows: 1,
  maxRows: 16,
  defaultRows: 1,
  addressUserEditable: true,
  showAddressColumn: true,
  showNoteColumn: false,
  hexFilePolicy: "disallowMultiRow",
  defaultAppAddress: 0x10000,
};
