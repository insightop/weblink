import type { LogEntry } from "../types/log";

export interface LogExportRow {
  id: string;
  ts: number;
  level: string;
  message: string;
  data: unknown;
}

/** Pure serialization for tests and stable export shape. */
export function buildLogExportRows(logs: LogEntry[]): LogExportRow[] {
  return logs.map(({ id, ts, level, message, data }) => ({
    id,
    ts,
    level,
    message,
    data: data === undefined ? null : data,
  }));
}

function formatFilenameTimestamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * Download current (typically filtered) logs as JSON.
 */
export function exportLogsJson(logs: LogEntry[], fileNamePrefix = "logs"): void {
  const payload = buildLogExportRows(logs);
  let text: string;
  try {
    text = JSON.stringify(payload, null, 2);
  } catch {
    text = JSON.stringify(
      payload.map((row) => ({
        ...row,
        data: row.data != null ? String(row.data) : null,
      })),
      null,
      2,
    );
  }
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileNamePrefix}-${formatFilenameTimestamp(new Date())}.json`;
  a.rel = "noopener";
  a.click();
  URL.revokeObjectURL(url);
}
