import { describe, expect, it } from "vitest";
import { dnsStatusDescription, parseDohJson } from "./parseDohResponse";

describe("parseDohJson", () => {
  it("parses valid json", () => {
    const r = parseDohJson('{"Status":0,"Question":[]}');
    expect(r.ok).toBe(true);
  });

  it("rejects invalid json", () => {
    const r = parseDohJson("not json");
    expect(r.ok).toBe(false);
  });
});

describe("dnsStatusDescription", () => {
  it("maps 0", () => {
    expect(dnsStatusDescription(0)).toBe("NOERROR");
  });
});
