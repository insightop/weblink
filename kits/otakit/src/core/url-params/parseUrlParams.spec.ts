import { describe, it, expect } from "vitest";
import { parseUrlParams } from "./parseUrlParams";

describe("parseUrlParams", () => {
  it("parses full known params with type conversion", () => {
    const p = parseUrlParams(
      "?protocol=mb-rtu&slaveId=1&baudrate=115200" +
        "&firmware=https://example.com/app.hex&auto=1&timeoutT1=1000&bypassFirmwareStart=0",
    );
    expect(p.protocol).toBe("mb-rtu");
    expect(p.slaveId).toBe(1);
    expect(p.baudrate).toBe(115200);
    expect(p.firmwareUrl).toBe("https://example.com/app.hex");
    expect(p.auto).toBe(true);
    expect(p.timeouts?.t1).toBe(1000);
    expect(p.bypassFirmwareStart).toBe(0);
  });

  it("returns defaults for empty search", () => {
    const p = parseUrlParams("");
    expect(p.protocol).toBe("mb-rtu");
    expect(p.slaveId).toBeUndefined();
    expect(p.auto).toBe(false);
  });

  it("ignores unknown params and parity/stopbits", () => {
    const p = parseUrlParams("?foo=bar&unknown=1&parity=1&stopbits=2");
    expect(p.protocol).toBe("mb-rtu");
    expect("foo" in p).toBe(false);
    expect("parity" in p).toBe(false);
    expect("stopbits" in p).toBe(false);
  });
});
