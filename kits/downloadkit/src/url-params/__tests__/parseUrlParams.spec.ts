import { describe, expect, it } from "vitest";
import { parseUrlParams } from "../parseUrlParams";

describe("parseUrlParams", () => {
  it("returns empty params for empty search", () => {
    const result = parseUrlParams("");
    expect(result.target).toBeUndefined();
    expect(result.programmer).toBeUndefined();
    expect(result.pluginConfig).toEqual({});
    expect(result.firmwareUrl).toBeUndefined();
    expect(result.firmwareAddr).toBeUndefined();
    expect(result.auto).toBeUndefined();
  });

  it("returns empty params for null/undefined search", () => {
    expect(parseUrlParams(null as unknown as string).target).toBeUndefined();
    expect(parseUrlParams(undefined as unknown as string).target).toBeUndefined();
  });

  it("parses target from query", () => {
    const result = parseUrlParams("?target=stm32");
    expect(result.target).toBe("stm32");
  });

  it("parses programmer from query", () => {
    const result = parseUrlParams("?programmer=serial");
    expect(result.programmer).toBe("serial");
  });

  it("parses target and programmer together", () => {
    const result = parseUrlParams("?target=esp32&programmer=serial");
    expect(result.target).toBe("esp32");
    expect(result.programmer).toBe("serial");
  });

  it("collects programmer_ prefixed params into pluginConfig", () => {
    const result = parseUrlParams("?programmer_baudRate=115200&programmer_debugClk=4000");
    expect(result.pluginConfig).toEqual({
      baudRate: "115200",
      debugClk: "4000",
    });
  });

  it("parses firmware URL and address", () => {
    const result = parseUrlParams("?firmware=https://example.com/fw.bin&addr=0x08000000");
    expect(result.firmwareUrl).toBe("https://example.com/fw.bin");
    expect(result.firmwareAddr).toBe("0x08000000");
  });

  it("parses auto flag", () => {
    const result = parseUrlParams("?auto=1");
    expect(result.auto).toBe("1");
  });

  it("ignores unknown parameters", () => {
    const result = parseUrlParams("?target=stm32&unknownKey=xxx&programmer=usb-dfu");
    expect(result.target).toBe("stm32");
    expect(result.programmer).toBe("usb-dfu");
    expect((result as any).unknownKey).toBeUndefined();
  });

  it("handles complex real-world URL", () => {
    const qs =
      "?target=stm32&programmer=serial&programmer_baudRate=921600&firmware=https://example.com/firmware.bin&addr=0x08000000&auto=1";
    const result = parseUrlParams(qs);
    expect(result).toEqual({
      target: "stm32",
      programmer: "serial",
      pluginConfig: { baudRate: "921600" },
      firmwareUrl: "https://example.com/firmware.bin",
      firmwareAddr: "0x08000000",
      auto: "1",
    });
  });

  it("parses search string without leading ?", () => {
    const result = parseUrlParams("target=stm32&programmer=serial");
    expect(result.target).toBe("stm32");
    expect(result.programmer).toBe("serial");
  });
});
