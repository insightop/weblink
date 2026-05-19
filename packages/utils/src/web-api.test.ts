import { describe, expect, it } from "vitest";
import { isSecureContext, isWebApiSupported } from "./web-api";

describe("isSecureContext", () => {
  it("returns a boolean", () => {
    expect(typeof isSecureContext()).toBe("boolean");
  });
});

describe("isWebApiSupported", () => {
  it("returns boolean for known APIs", () => {
    expect(typeof isWebApiSupported("serial")).toBe("boolean");
    expect(typeof isWebApiSupported("usb")).toBe("boolean");
    expect(typeof isWebApiSupported("hid")).toBe("boolean");
    expect(typeof isWebApiSupported("bluetooth")).toBe("boolean");
    expect(typeof isWebApiSupported("nfc")).toBe("boolean");
    expect(typeof isWebApiSupported("media")).toBe("boolean");
  });
});
