import { describe, expect, it } from "vitest";
import {
  formatNmeaForDisplay,
  isNmeaChecksumValid,
  parseNmeaMessage,
} from "./nmea.js";

describe("parseNmeaMessage", () => {
  it("parses GNRMC", () => {
    const raw =
      "$GNRMC,124050.00,V,3119.41396,N,12034.17977,E,,,070426,,,N,V*2F";
    const r = parseNmeaMessage(raw);
    expect(r.type).toBe("gnrmc");
    expect(r.sentences.length).toBe(1);
  });

  it("parses GPGSV multi-line message type", () => {
    const raw = [
      "$GPGSV,5,1,17,05,38,087,24,13,37,039,,15,62,007,,18,55,302,,0*63",
      "$GPGSV,5,2,17,20,44,036,,21,13,098,25,23,28,311,,24,55,171,27,0*68",
    ].join("\n");
    const r = parseNmeaMessage(raw);
    expect(r.type).toBe("gpgsv");
    expect(r.sentences.length).toBe(2);
  });

  it("recognizes GAGSV talker as gagsv", () => {
    const raw = "$GAGSV,1,1,02,07,22,044,,12,21,320,,0*70";
    const r = parseNmeaMessage(raw);
    expect(r.type).toBe("gagsv");
  });

  it("formats GBGSV from comma fields (PRN / elev / azim / SNR)", () => {
    const raw =
      "$GBGSV,2,1,05,01,46,138,28,07,49,210,27,11,45,148,33,0*42\n" +
      "$GBGSV,2,2,05,34,18,148,26,0*45";
    const r = parseNmeaMessage(raw);
    expect(r.type).toBe("gbgsv");
    const disp = formatNmeaForDisplay("gbgsv", r.sentences);
    const prn1 = disp.rows.find((row) => row.label === "PRN 01");
    expect(prn1?.value).toMatch(/46°\/138°\/28dB/);
    const prn34 = disp.rows.find((row) => row.label === "PRN 34");
    expect(prn34?.value).toMatch(/18°\/148°\/26dB/);
  });

  it("rejects lines with invalid NMEA checksum", () => {
    const good =
      "$GNRMC,124050.00,V,3119.41396,N,12034.17977,E,,,070426,,,N,V*2F";
    expect(isNmeaChecksumValid(good)).toBe(true);
    const bad = good.replace("*2F", "*00");
    expect(isNmeaChecksumValid(bad)).toBe(false);
    const r = parseNmeaMessage(bad);
    expect(r.type).toBe("unknown");
    expect(r.sentences.length).toBe(0);
    expect(r.checksumRejected.length).toBe(1);
  });

  it("keeps valid lines when mixed with one bad checksum", () => {
    const good1 =
      "$GBGSV,2,1,05,01,46,138,28,07,49,210,27,11,45,148,33,0*42";
    const good2 = "$GBGSV,2,2,05,34,18,148,26,0*45";
    const bad2 = good2.replace("*45", "*00");
    const r = parseNmeaMessage(`${good1}\n${bad2}`);
    expect(r.sentences.length).toBe(1);
    expect(r.checksumRejected.length).toBe(1);
  });

  it("pads GSV azimuth and shows empty SNR as --dB", () => {
    const raw =
      "$GPGSV,5,1,17,05,38,087,24,13,37,039,,15,62,007,,18,55,302,,0*63";
    const r = parseNmeaMessage(raw);
    expect(r.type).toBe("gpgsv");
    const disp = formatNmeaForDisplay("gpgsv", r.sentences);
    const prn13 = disp.rows.find((row) => row.label === "PRN 13");
    expect(prn13?.value).toMatch(/37°\/039°\/--dB/);
  });
});

