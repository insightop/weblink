import { IpKitError, IpKitErrorCode } from "../../domain/errors/IpKitError";
import {
  buildHttpResponseSummary,
  type HttpResponseSummary,
} from "../../domain/http/parseResponseSummary";
import {
  emptyTiming,
  formatTimingLine,
  summarizeTimingFromResource,
  type TimingSummary,
} from "../../domain/timing/summarizeTiming";
import { createLogger } from "../logger/createLogger";

const log = createLogger("fetchWithMetrics");

const DEFAULT_MAX_BODY = 512 * 1024;

export interface FetchWithMetricsResult {
  summary: HttpResponseSummary;
  timing: TimingSummary;
  timingLine: string;
}

export async function fetchWithMetrics(
  url: string,
  init: RequestInit,
  options?: { maxBodyBytes?: number; signal?: AbortSignal },
): Promise<FetchWithMetricsResult> {
  const maxBodyBytes = options?.maxBodyBytes ?? DEFAULT_MAX_BODY;
  const signal = options?.signal;

  const t0 = typeof performance !== "undefined" ? performance.now() : 0;

  let response: Response;
  try {
    response = await fetch(url, { ...init, signal });
  } catch (e) {
    if (signal?.aborted) {
      throw new IpKitError(IpKitErrorCode.ABORTED, "请求已取消", { cause: e });
    }
    throw IpKitError.fromUnknown(
      IpKitErrorCode.NETWORK,
      e,
      "网络错误（可能是 CORS、DNS 或连接被拒绝）",
    );
  }

  const t1 = typeof performance !== "undefined" ? performance.now() : 0;
  const manualMs = t1 - t0;

  const summary = await buildHttpResponseSummary(response, maxBodyBytes);

  let timing = summarizeTimingFromResource(url);
  if (timing.durationMs == null || timing.durationMs === 0) {
    timing = {
      ...emptyTiming(),
      durationMs: manualMs,
    };
  }

  const timingLine =
    timing.durationMs != null
      ? formatTimingLine(timing)
      : `总耗时约 ${manualMs.toFixed(1)} ms（PerformanceResourceTiming 不可用）`;

  log.debug("fetch done", { status: summary.status, url: summary.url });

  return { summary, timing, timingLine };
}
