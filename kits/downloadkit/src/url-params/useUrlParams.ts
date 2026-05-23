import { computed } from "vue";
import { useRoute } from "vue-router";
import { parseUrlParams } from "./parseUrlParams";
import { fetchFirmware } from "./fetchFirmware";
import type { UrlParams } from "./types";
import type { useFlasherStore } from "../features/flasher/stores/flasher.store";
import type { FirmwareInputPanelExpose } from "../features/flasher/components/firmwareInputPanelExpose";
import { globalPluginRegistry } from "../plugins/registry";

export interface UrlParamsApplyDeps {
  store: ReturnType<typeof useFlasherStore>;
  firmwareInput: FirmwareInputPanelExpose;
}

export interface UrlParamsApplyResult {
  autoStart: boolean;
}

const EMBEDDED = import.meta.env.VITE_EMBEDDED === "true";

function resolveCurrentPlugin(chipFamily: string | undefined, programmer: string | undefined): string | undefined {
  if (!chipFamily || !programmer) return undefined;
  const plugin = globalPluginRegistry.tryResolve({
    chipFamily: chipFamily as any,
    flasherType: programmer as any,
    capabilities: { webSerial: true, webUsb: true, webHid: true },
  });
  return plugin?.id;
}

/** Vue composable: 从 URL query 参数读取配置并注入 flasher store。 */
export function useUrlParams() {
  const route = useRoute();

  const params = computed<UrlParams>(() => {
    if (EMBEDDED) return { pluginConfig: {} };
    const raw = route.query;
    const qs = Object.entries(raw)
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v ?? ""))}`)
      .join("&");
    return parseUrlParams(qs ? `?${qs}` : "");
  });

  const hasParams = computed(() => {
    const p = params.value;
    return !!(p.target || p.programmer || p.firmwareUrl);
  });

  async function apply(deps: UrlParamsApplyDeps): Promise<UrlParamsApplyResult> {
    const { store, firmwareInput } = deps;
    const p = params.value;

    if (!p.target && !p.programmer && !p.firmwareUrl) {
      return { autoStart: false };
    }

    // 1. Apply target and programmer
    if (p.target) store.setChipFamily(p.target as any);
    if (p.programmer) store.setFlasherType(p.programmer as any);

    // 2. Apply plugin config
    const configKeys = Object.keys(p.pluginConfig);
    if (configKeys.length > 0) {
      const pluginId = resolveCurrentPlugin(p.target, p.programmer);
      if (pluginId) {
        const existing = store.getPluginConfig(pluginId) ?? {};
        store.setPluginConfig(pluginId, { ...existing, ...p.pluginConfig });
      }
    }

    // 3. Fetch firmware if URL provided
    if (p.firmwareUrl) {
      const firmware = await fetchFirmware(p.firmwareUrl);
      const file = new File([firmware.blob], firmware.name, {
        type: firmware.blob.type || "application/octet-stream",
      });
      firmwareInput.restoreFirmwareRows([
        {
          rowId: `url-${Date.now()}`,
          addressStr: p.firmwareAddr ?? "",
          note: "",
          file: {
            name: file.name,
            type: file.type,
            size: file.size,
            lastModified: Date.now(),
            blob: file,
          },
        },
      ]);
    }

    return { autoStart: p.auto === "1" };
  }

  return { params, hasParams, apply };
}
