export type NdefRecordVm = {
  recordType: string;
  mediaType?: string;
  id?: string;
  summary: string;
};

export type NdefMessageVm = {
  recordCount: number;
  records: NdefRecordVm[];
};

function safeDecodeDataView(dv?: DataView): string {
  if (!dv) return "";
  const bytes = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
  // best-effort: text if decodable, otherwise hex-ish
  try {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const printable = text.replaceAll("\u0000", "");
    if (printable.trim()) return printable;
  } catch {
    // ignore
  }
  return Array.from(bytes)
    .slice(0, 64)
    .map((b) => b.toString(16).toUpperCase().padStart(2, "0"))
    .join(" ");
}

function summarizeRecord(r: NDEFRecord): string {
  const t = r.recordType ?? "unknown";
  if (t === "url") return safeDecodeDataView(r.data) || "URL";
  if (t === "text") {
    const v = safeDecodeDataView(r.data);
    const lang = r.lang ? `${r.lang} ` : "";
    return `${lang}${v}`.trim() || "Text";
  }
  if (t === "mime") return r.mediaType ? `MIME: ${r.mediaType}` : "MIME";
  if (t === "absolute-url") return safeDecodeDataView(r.data) || "Absolute URL";
  return safeDecodeDataView(r.data) || t;
}

export function formatNdefMessage(message: NDEFMessage): NdefMessageVm {
  const records = (message?.records ?? []).map((r) => ({
    recordType: r.recordType ?? "unknown",
    mediaType: r.mediaType,
    id: r.id,
    summary: summarizeRecord(r),
  }));
  return { recordCount: records.length, records };
}

