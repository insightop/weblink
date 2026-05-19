import { describe, expect, it } from "vitest";
import {
  ggaTierFromSentence,
  gsaTierFromSentences,
  gsvSignalTierFromMetrics,
  rmcTierFromSentence,
  worstNmeaSignalTier,
} from "./nmeaSignalTier.js";

describe("rmcTierFromSentence", () => {
  it("raw A is green", () => {
    expect(rmcTierFromSentence({ fields: ["", "A"] })).toBe("green");
  });
  it("raw V is red", () => {
    expect(rmcTierFromSentence({ fields: ["", "V"] })).toBe("red");
  });
  it("lib valid is green", () => {
    expect(rmcTierFromSentence({ status: "valid" })).toBe("green");
  });
  it("lib invalid is red", () => {
    expect(rmcTierFromSentence({ status: "invalid" })).toBe("red");
  });
});

describe("ggaTierFromSentence", () => {
  it("raw fix 0 is red", () => {
    expect(ggaTierFromSentence({ fields: ["", "", "", "", "", "0"] })).toBe(
      "red",
    );
  });
  it("raw fix 1 is green", () => {
    expect(ggaTierFromSentence({ fields: ["", "", "", "", "", "1"] })).toBe(
      "green",
    );
  });
  it("raw fix 4 RTK fixed is green", () => {
    expect(ggaTierFromSentence({ fields: ["", "", "", "", "", "4"] })).toBe(
      "green",
    );
  });
  it("raw fix 5 float is yellow", () => {
    expect(ggaTierFromSentence({ fields: ["", "", "", "", "", "5"] })).toBe(
      "yellow",
    );
  });
  it("lib none is red", () => {
    expect(ggaTierFromSentence({ fixType: "none" })).toBe("red");
  });
  it("lib rtk-fixed is green", () => {
    expect(ggaTierFromSentence({ fixType: "rtk-fixed" })).toBe("green");
  });
  it("lib dgps-fix is blue", () => {
    expect(ggaTierFromSentence({ fixType: "dgps-fix" })).toBe("blue");
  });
});

describe("gsaTierFromSentences", () => {
  it("single system 3D is green", () => {
    const f = ["A", "3", ...Array(12).fill(""), "1", "1", "1", "1"];
    expect(gsaTierFromSentences([{ fields: f }])).toBe("green");
  });
  it("single system no fix is red", () => {
    const f = ["A", "1", ...Array(12).fill(""), "1", "1", "1", "1"];
    expect(gsaTierFromSentences([{ fields: f }])).toBe("red");
  });
  it("multi: 3D + no fix → worst red", () => {
    const sats = () => Array(12).fill("");
    const gsa = (fix, sysId) => ({
      fields: ["A", String(fix), ...sats(), "1", "1", "1", String(sysId)],
    });
    expect(gsaTierFromSentences([gsa(3, 1), gsa(1, 4)])).toBe("red");
  });
});

describe("gsvSignalTierFromMetrics", () => {
  it("no valid sats is red", () => {
    expect(gsvSignalTierFromMetrics(0, null)).toBe("red");
  });
  it("avg 35 is blue", () => {
    expect(gsvSignalTierFromMetrics(2, 35)).toBe("blue");
  });
  it("all zero avg with no valid sats is red", () => {
    expect(gsvSignalTierFromMetrics(0, 0)).toBe("red");
  });
});

describe("worstNmeaSignalTier", () => {
  it("picks red over green", () => {
    expect(worstNmeaSignalTier(["green", "red"])).toBe("red");
  });
});
