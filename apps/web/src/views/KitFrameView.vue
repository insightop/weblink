<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { NButton, NResult } from "naive-ui";
import { findKit, resolveKitUrl } from "@/config/kitRegistry";

const route = useRoute();
const kitId = computed(() => route.name as string);
const kit = computed(() => findKit(kitId.value));
const isLocal = false;
const kitUrl = computed(() => {
  if (!kit.value) return "";
  return resolveKitUrl(kit.value, isLocal.value);
});
const kitReady = computed(() => kit.value !== undefined && kitUrl.value !== "");
</script>

<template>
  <div class="frame-page">
    <div v-if="kitReady" class="frame-container">
      <iframe
        :src="kitUrl"
        class="kit-frame"
        allow="serial;usb;hid;bluetooth;nfc;camera;microphone;fullscreen"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
    <div v-else class="not-found">
      <NResult
        status="404"
        title="Kit Not Found"
        :description="`'${kitId}' is not available.`"
      >
        <template #footer>
          <NButton tag="a" href="/" type="primary">Back to Home</NButton>
        </template>
      </NResult>
    </div>
  </div>
</template>

<style scoped>
.frame-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
}
.frame-container {
  flex: 1;
  min-height: 0;
}
.kit-frame {
  width: 100%;
  height: 100%;
  border: none;
}
.not-found {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}
</style>
