export interface TimingSummary {
  durationMs: number | null;
  dnsMs: number | null;
  tcpMs: number | null;
  tlsMs: number | null;
  ttfbMs: number | null;
  transferMs: number | null;
}

export function summarizeTimingFromResource(url: string): TimingSummary {
  if (typeof performance === "undefined") {
    return emptyTiming();
  }
  const entries = performance.getEntriesByName(url, "resource") as PerformanceResourceTiming[];
  const last = entries[entries.length - 1];
  if (!last) {
    return emptyTiming();
  }
  return {
    durationMs: last.duration,
    dnsMs: last.domainLookupEnd - last.domainLookupStart,
    tcpMs: last.connectEnd - last.connectStart,
    tlsMs: last.secureConnectionStart > 0 ? last.connectEnd - last.secureConnectionStart : null,
    ttfbMs: last.responseStart - last.requestStart,
    transferMs: last.responseEnd - last.responseStart,
  };
}

export function emptyTiming(): TimingSummary {
  return {
    durationMs: null,
    dnsMs: null,
    tcpMs: null,
    tlsMs: null,
    ttfbMs: null,
    transferMs: null,
  };
}

export function formatTimingLine(t: TimingSummary): string {
  const parts: string[] = [];
  if (t.durationMs != null) {
    parts.push(`总耗时 ${t.durationMs.toFixed(1)} ms`);
  }
  if (t.ttfbMs != null) {
    parts.push(`TTFB ${t.ttfbMs.toFixed(1)} ms`);
  }
  if (t.dnsMs != null && t.dnsMs > 0) {
    parts.push(`DNS ${t.dnsMs.toFixed(1)} ms`);
  }
  if (t.tcpMs != null && t.tcpMs > 0) {
    parts.push(`TCP ${t.tcpMs.toFixed(1)} ms`);
  }
  if (t.tlsMs != null && t.tlsMs > 0) {
    parts.push(`TLS ${t.tlsMs.toFixed(1)} ms`);
  }
  return parts.join(" · ");
}
