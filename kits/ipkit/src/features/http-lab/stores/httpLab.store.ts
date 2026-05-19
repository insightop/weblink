import { defineStore } from "pinia";
import { ref } from "vue";
import { buildFetchInit, type HttpRequestDraft } from "@/domain/http/buildFetchInit";
import type { FetchWithMetricsResult } from "@/infrastructure/net/fetchWithMetrics";
import { fetchWithMetrics } from "@/infrastructure/net/fetchWithMetrics";
import { IpKitError } from "@/domain/errors/IpKitError";

export const useHttpLabStore = defineStore("httpLab", () => {
  const method = ref("GET");
  const url = ref("https://httpbin.org/get");
  const headersText = ref("");
  const bodyText = ref("");
  const loading = ref(false);
  const lastResult = ref<FetchWithMetricsResult | null>(null);
  const lastError = ref<string | null>(null);

  async function send(signal: AbortSignal): Promise<void> {
    lastError.value = null;
    const draft: HttpRequestDraft = {
      method: method.value,
      url: url.value,
      headersText: headersText.value,
      bodyText: bodyText.value,
    };

    const built = buildFetchInit(draft);
    if (!built.ok) {
      lastError.value = built.error.toUserMessage();
      return;
    }

    loading.value = true;
    lastResult.value = null;
    try {
      const result = await fetchWithMetrics(built.value.url, built.value.init, {
        signal,
        maxBodyBytes: 512 * 1024,
      });
      lastResult.value = result;
    } catch (e) {
      const msg =
        e instanceof IpKitError ? e.toUserMessage() : e instanceof Error ? e.message : String(e);
      lastError.value = msg;
    } finally {
      loading.value = false;
    }
  }

  return {
    method,
    url,
    headersText,
    bodyText,
    loading,
    lastResult,
    lastError,
    send,
  };
});
