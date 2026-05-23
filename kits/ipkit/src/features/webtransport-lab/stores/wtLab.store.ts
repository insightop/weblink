import { defineStore } from "pinia";
import { ref } from "vue";
import {
  probeWebTransport,
  type WebTransportProbeResult,
} from "../../../infrastructure/net/webTransportClient";

export const useWtLabStore = defineStore("wtLab", () => {
  const url = ref("https://echo.webtransport.day/");
  const loading = ref(false);
  const lastProbe = ref<WebTransportProbeResult | null>(null);

  async function probe(): Promise<void> {
    loading.value = true;
    lastProbe.value = null;
    try {
      lastProbe.value = await probeWebTransport(url.value.trim());
    } finally {
      loading.value = false;
    }
  }

  return { url, loading, lastProbe, probe };
});
