<script setup lang="ts">
import { NAlert } from "naive-ui";
import { computed } from "vue";
import { detectCapabilities } from "../infrastructure/browser/detectCapabilities";
import { useSecureContext } from "../shared/composables/useSecureContext";

const secure = useSecureContext();
const caps = computed(() => detectCapabilities());

const warnings = computed(() => {
  const list: string[] = [];
  if (!secure.value) {
    list.push("当前不是安全上下文（需 HTTPS 或 localhost），部分 Web API 不可用。");
  }
  if (!caps.value.fetch) {
    list.push("当前环境无 fetch，HTTP/DoH 不可用。");
  }
  if (!caps.value.webSocket) {
    list.push("当前环境无 WebSocket。");
  }
  return list;
});
</script>

<template>
  <div v-if="warnings.length" class="banner-stack">
    <NAlert v-for="(w, i) in warnings" :key="i" type="warning" :bordered="false" class="banner">
      {{ w }}
    </NAlert>
  </div>
</template>

<style scoped>
.banner-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.banner {
  border-radius: 8px;
}
</style>
