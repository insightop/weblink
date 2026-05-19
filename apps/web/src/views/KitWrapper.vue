<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { NResult, NButton, NSpin } from "naive-ui";
import { findKit } from "@/config/kitRegistry";

const route = useRoute();
const kitId = computed(() => route.params.kitId as string);
const kitConfig = computed(() => findKit(kitId.value));

// 异步加载的组件
const AsyncComponent = ref<any>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const kitLoaders: Record<string, () => Promise<any>> = {
  serialkit: () => import("@weblink/serialkit"),
  cankit: () => import("@weblink/cankit"),
  capturekit: () => import("@weblink/capturekit"),
  downloadkit: () => import("@weblink/downloadkit"),
  flashkit: () => import("@weblink/flashkit"),
  ipkit: () => import("@weblink/ipkit"),
  webrtckit: () => import("@weblink/webrtckit"),
  wirelesskit: () => import("@weblink/wirelesskit"),
};

// iframe kit 的 URL
const iframeUrl = computed(() => {
  if (!kitConfig.value) return "";
  const config = kitConfig.value;
  if (config.stack === "js" || config.stack === "svelte") {
    return import.meta.env.DEV && config.localPort
      ? `http://localhost:${config.localPort}`
      : config.prodUrl;
  }
  return "";
});

const isIframeKit = computed(() => {
  return kitConfig.value?.stack === "js" || kitConfig.value?.stack === "svelte";
});

async function loadKit(id: string) {
  AsyncComponent.value = null;
  error.value = null;
  loading.value = true;

  try {
    const loader = kitLoaders[id];
    if (!loader) {
      error.value = "Kit loader not found";
      return;
    }
    const mod = await loader();
    AsyncComponent.value = mod.App;
  } catch (e: any) {
    error.value = e?.message ?? "Failed to load kit";
  } finally {
    loading.value = false;
  }
}

// 监听路由变化，加载对应 kit
watch(
  kitId,
  (id) => {
    if (id && kitConfig.value && !isIframeKit.value) {
      loadKit(id);
    }
  },
  { immediate: true },
);

const kitNotFound = computed(() => !kitConfig.value);
</script>

<template>
  <div class="kit-wrapper">
    <NResult v-if="kitNotFound" status="404" title="Kit Not Found">
      <template #footer>
        <NButton tag="a" href="/" type="primary">Back to Home</NButton>
      </template>
    </NResult>

    <NResult v-else-if="error" status="error" title="Load Failed" :description="error">
      <template #footer>
        <NButton tag="a" href="/" type="primary">Back to Home</NButton>
      </template>
    </NResult>

    <template v-else-if="isIframeKit">
      <iframe
        v-if="iframeUrl"
        :src="iframeUrl"
        class="kit-iframe"
        allow="serial;usb;hid;bluetooth;nfc;camera;microphone"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </template>

    <template v-else>
      <div v-if="loading" class="loading">
        <NSpin size="large" />
      </div>
      <AsyncComponent v-else-if="AsyncComponent" />
    </template>
  </div>
</template>

<style scoped>
.kit-wrapper {
  height: 100vh;
  width: 100%;
  display: flex;
  flex-direction: column;
}
.kit-iframe {
  flex: 1;
  width: 100%;
  border: none;
}
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
</style>
