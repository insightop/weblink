import { describe, expect, it } from "vitest";
import { listDfuInterfaces, pickBestDfuInterface } from "@/protocols/stm32/dfu/adapters/DfuInterfaceSelector";

describe("DfuInterfaceSelector", () => {
  it("keeps protocol 0x00 legacy DFU interfaces", () => {
    const device = {
      configurations: [
        {
          configurationValue: 1,
          interfaces: [
            {
              interfaceNumber: 0,
              alternates: [
                {
                  interfaceClass: 0xfe,
                  interfaceSubclass: 0x01,
                  interfaceProtocol: 0x00,
                  alternateSetting: 0,
                  interfaceName: "@Internal Flash /0x08000000/512*002Kg",
                },
              ],
            },
          ],
        },
      ],
    } as unknown as USBDevice;

    const interfaces = listDfuInterfaces(device);
    expect(interfaces).toHaveLength(1);
    expect(interfaces[0].interfaceProtocol).toBe(0x00);
  });

  it("prefers protocol 0x02, then 0x00", () => {
    const selected = pickBestDfuInterface([
      {
        configurationValue: 1,
        interfaceNumber: 0,
        alternateSetting: 0,
        interfaceProtocol: 0x00,
        interfaceName: "@Internal Flash /0x08000000/512*002Kg",
      },
      {
        configurationValue: 1,
        interfaceNumber: 0,
        alternateSetting: 1,
        interfaceProtocol: 0x02,
        interfaceName: "@Option Bytes /0x1FFFF800/01*016 g",
      },
    ]);
    expect(selected?.interfaceProtocol).toBe(0x02);
  });
});
