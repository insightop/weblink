import { describe, expect, it } from "vitest";
import { parseHexAddressString, resolveDynamicFirmwareAddress } from "@/core/firmware/resolveSegmentAddresses";
import type { FirmwareInputPolicy } from "@/plugins/types";

const editablePolicy: FirmwareInputPolicy = {
  minRows: 1,
  maxRows: 4,
  defaultRows: 1,
  addressUserEditable: true,
  showAddressColumn: true,
  hexFilePolicy: "allow",
  defaultAppAddress: 0x0800_0000,
};

const fixedPolicy: FirmwareInputPolicy = {
  minRows: 1,
  maxRows: 1,
  defaultRows: 1,
  addressUserEditable: false,
  showAddressColumn: false,
  hexFilePolicy: "allow",
  defaultAppAddress: 0x0800_0000,
};

describe("resolveSegmentAddresses", () => {
  it("parseHexAddressString accepts 0x prefix", () => {
    expect(parseHexAddressString("0x08000000")).toBe(0x08000000);
    expect(parseHexAddressString("10000")).toBe(0x10000);
  });

  it("resolveDynamicFirmwareAddress prefers user address when editable", () => {
    expect(
      resolveDynamicFirmwareAddress({
        policy: editablePolicy,
        chipFamily: "stm32",
        hexBaseAddr: null,
        userAddress: 0x08001000,
      }),
    ).toBe(0x08001000);
  });

  it("resolveDynamicFirmwareAddress uses hex base when not editable", () => {
    expect(
      resolveDynamicFirmwareAddress({
        policy: fixedPolicy,
        chipFamily: "stm32",
        hexBaseAddr: 0x08002000,
        userAddress: null,
      }),
    ).toBe(0x08002000);
  });
});
