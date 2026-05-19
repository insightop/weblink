import { describe, expect, it } from "vitest";
import { buildLogExportRows } from "@/features/flasher/services/logExport";
import type { LogEntry } from "@/features/flasher/types/log";

describe("logExport", () => {
  it("buildLogExportRows maps context undefined to null", () => {
    const logs: LogEntry[] = [
      {
        id: "1",
        timestamp: "2026-01-01T00:00:00.000Z",
        level: "info",
        message: "hello",
      },
      {
        id: "2",
        timestamp: "2026-01-01T00:00:01.000Z",
        level: "debug",
        message: "x",
        context: { n: 1 },
      },
    ];
    const rows = buildLogExportRows(logs);
    expect(rows[0].context).toBeNull();
    expect(rows[1].context).toEqual({ n: 1 });
  });
});
