import { onMounted, onUnmounted, ref } from "vue";
import {
  enumerateDevices,
  onDeviceChange,
} from "@/infrastructure/media/mediaDevicesFacade";
import { mapMediaError } from "@/domain/media/errors";
import { logger } from "@/infrastructure/logging/logger";

export function useEnumerateDevices() {
  const devices = ref<MediaDeviceInfo[]>([]);
  const error = ref<string | null>(null);
  const loading = ref(false);

  async function refresh(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      devices.value = await enumerateDevices();
    } catch (e) {
      error.value = mapMediaError(e);
      logger.warn("enumerateDevices", e);
    } finally {
      loading.value = false;
    }
  }

  let unsubscribe: (() => void) | undefined;

  onMounted(() => {
    void refresh();
    unsubscribe = onDeviceChange(() => {
      void refresh();
    });
  });

  onUnmounted(() => {
    unsubscribe?.();
  });

  return { devices, error, loading, refresh };
}
