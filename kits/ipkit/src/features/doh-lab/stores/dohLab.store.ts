import { defineStore } from "pinia";
import { ref } from "vue";
import { buildDnsJsonUrl, type DnsJsonType } from "@/domain/doh/buildDnsJsonUrl";
import { dnsStatusDescription } from "@/domain/doh/parseDohResponse";
import type { DnsJsonDocument } from "@/domain/doh/parseDohResponse";
import { fetchDnsJson } from "@/infrastructure/net/dohFetch";
import { IpKitError } from "@/domain/errors/IpKitError";

export const DOH_PRESETS = [
  {
    id: "cf",
    label: "Cloudflare 1.1.1.1 (dns-json)",
    baseUrl: "https://cloudflare-dns.com/dns-query",
  },
  {
    id: "google",
    label: "Google Public DNS (dns-json)",
    baseUrl: "https://dns.google/resolve",
  },
] as const;

export const useDohLabStore = defineStore("dohLab", () => {
  const presetId = ref<(typeof DOH_PRESETS)[number]["id"]>("cf");
  const name = ref("example.com");
  const type = ref<DnsJsonType>("A");
  const loading = ref(false);
  const lastDocument = ref<DnsJsonDocument | null>(null);
  const lastRaw = ref<string | null>(null);
  const lastError = ref<string | null>(null);
  const statusLine = ref("");

  function resolverBase(): string {
    const p = DOH_PRESETS.find((x) => x.id === presetId.value);
    return p?.baseUrl ?? DOH_PRESETS[0].baseUrl;
  }

  async function query(signal: AbortSignal): Promise<void> {
    lastError.value = null;
    lastDocument.value = null;
    lastRaw.value = null;
    statusLine.value = "";

    const built = buildDnsJsonUrl({
      resolverBaseUrl: resolverBase(),
      name: name.value,
      type: type.value,
    });
    if (!built.ok) {
      lastError.value = built.error.toUserMessage();
      return;
    }

    loading.value = true;
    try {
      const { rawText, document } = await fetchDnsJson(built.value, { signal });
      lastRaw.value = rawText;
      lastDocument.value = document;
      statusLine.value = `Status ${document.Status} (${dnsStatusDescription(document.Status)})`;
    } catch (e) {
      const msg =
        e instanceof IpKitError ? e.toUserMessage() : e instanceof Error ? e.message : String(e);
      lastError.value = msg;
    } finally {
      loading.value = false;
    }
  }

  return {
    presetId,
    name,
    type,
    loading,
    lastDocument,
    lastRaw,
    lastError,
    statusLine,
    resolverBase,
    query,
  };
});
