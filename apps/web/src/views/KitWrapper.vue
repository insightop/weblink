<script setup lang="ts">
import { computed, defineAsyncComponent, h } from "vue";
import { useRoute } from "vue-router";
import { NResult, NButton } from "naive-ui";
import { findKit } from "@/config/kitRegistry";

const route = useRoute();
const kitId = computed(() => route.params.kitId as string);
const kitConfig = computed(() => findKit(kitId.value));

const KitComponent = computed(() => {
  if (!kitConfig.value) return null;
  const config = kitConfig.value;

  if (config.stack === "js" || config.stack === "svelte") {
    // iframe 兜底：JS 和 Svelte kit
    return defineAsyncComponent(() =>
      Promise.resolve({
        setup() {
          const url =
            import.meta.env.DEV && config.localPort
              ? `http://localhost:${config.localPort}`
              : config.prodUrl;
          return () =>
            h("div", { style: "height: 100%; width: 100%" }, [
              h("iframe", {
                src: url,
                style: "width: 100%; height: 100%; border: none",
                allow: "serial;usb;hid;bluetooth;nfc;camera;microphone",
                sandbox: "allow-scripts allow-same-origin allow-forms allow-popups",
              }),
            ]);
        },
      }),
    );
  }

  // Vue kit：动态 import
  const loaders: Record<string, () => Promise<any>> = {
    serialkit: () => import("@weblink/serialkit"),
    cankit: () => import("@weblink/cankit"),
    capturekit: () => import("@weblink/capturekit"),
    downloadkit: () => import("@weblink/downloadkit"),
    flashkit: () => import("@weblink/flashkit"),
    ipkit: () => import("@weblink/ipkit"),
    webrtckit: () => import("@weblink/webrtckit"),
    wirelesskit: () => import("@weblink/wirelesskit"),
  };

  const loader = loaders[config.id];
  if (!loader) return null;

  return defineAsyncComponent(() =>
    loader().then((mod) => ({
      setup() {
        return () => h(mod.App);
      },
    })),
  );
});

const kitNotFound = computed(() => !kitConfig.value);
const kitUnavailable = computed(() => kitConfig.value && !KitComponent.value);
</script>

<template>
  <div class="kit-wrapper">
    <NResult v-if="kitNotFound" status="404" title="Kit Not Found">
      <template #footer>
        <NButton tag="a" href="/" type="primary">Back to Home</NButton>
      </template>
    </NResult>
    <NResult v-else-if="kitUnavailable" status="info" title="Kit Coming Soon">
      <template #footer>
        <NButton tag="a" href="/" type="primary">Back to Home</NButton>
      </template>
    </NResult>
    <Suspense v-else>
      <template #default>
        <KitComponent v-if="KitComponent" />
      </template>
      <template #fallback>
        <div class="loading">Loading...</div>
      </template>
    </Suspense>
  </div>
</template>

<style scoped>
.kit-wrapper {
  height: 100vh;
  display: flex;
  flex-direction: column;
}
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
</style>
