import { describe, expect, it } from "vitest";
import { buildLogExportRows } from "./logExport";
import type { LogEntry } from "../types/log";

describe("logExport", () => {
  it("buildLogExportRows maps data undefined to null", () => {
    const logs: LogEntry[] = [
      {
        id: "1",
        ts: 1704067200000,
        level: "info",
        message: "hello",
      },
      {
        id: "2",
        ts: 1704067201000,
        level: "debug",
        message: "x",
        data: { n: 1 },
      },
    ];
    const rows = buildLogExportRows(logs);
    expect(rows[0].data).toBeNull();
    expect(rows[1].data).toEqual({ n: 1 });
  });
});
