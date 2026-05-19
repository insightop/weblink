<script setup lang="ts">
import { onMounted } from "vue";
import { useFlasherStore } from "@/features/flasher/stores/flasher.store";
import { prepareFlasherForCurrentSelection, getFlasherRuntimeInfo } from "@/features/flasher/services/flasherFacade";
import { flasherLogger } from "@/features/flasher/services/flasherLogger";

const store = useFlasherStore();
const modes = ["serial", "usb-dfu", "st-link", "dap-link"] as const;

const selectMode = async (mode: (typeof modes)[number]): Promise<void> => {
  store.setChipFamily("stm32");
  store.setFlasherType(mode);
  store.setFlasherRuntime(getFlasherRuntimeInfo());
  try {
    await prepareFlasherForCurrentSelection();
  } catch (error) {
    flasherLogger.error(error instanceof Error ? error.message : String(error));
  }
};

onMounted(async () => {
  store.setFlasherRuntime(getFlasherRuntimeInfo());
  await selectMode(store.flasherType ?? "serial");
});
</script>

<template>
  <div class="panel">
    <div class="mode-row">
      <button
        v-for="mode in modes"
        :key="mode"
        class="mode-btn"
        :class="{ active: store.flasherType === mode }"
        @click="selectMode(mode)"
      >
        {{ mode }}
      </button>
    </div>
    <p class="meta">
      Flasher: {{ store.flasherLabel ?? "未选择" }}
      <span v-if="store.flasherError" class="warn">({{ store.flasherError }})</span>
    </p>
  </div>
</template>

<style scoped>
.panel { display: grid; gap: 8px; }
.mode-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.mode-btn { border: 1px solid #cbd5e1; background: #fff; color: #334155; border-radius: 8px; height: 36px; }
.mode-btn.active { background: #2563eb; border-color: #2563eb; color: #fff; font-weight: 600; }
.meta { margin: 0; color: #475569; font-size: 13px; }
.warn { color: #b91c1c; }
</style>
