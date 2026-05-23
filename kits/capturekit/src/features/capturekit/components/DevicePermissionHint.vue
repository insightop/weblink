<script setup lang="ts">
import { computed } from "vue";
import { isSecureMediaContext } from "../../../shared/utils/secureContext";

const ok = computed(() => isSecureMediaContext());
</script>

<template>
  <div v-if="!ok" class="hint hint--danger">
    非安全上下文：请使用 HTTPS 或 localhost，否则摄像头/麦克风不可用。
  </div>
</template>

<style scoped>
.hint {
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius);
  margin-bottom: 0.75rem;
  font-size: 0.85rem;
  line-height: 1.4;
}
.hint--danger {
  background: rgba(248, 81, 73, 0.15);
  border: 1px solid var(--color-danger);
  color: #ffb4b0;
}
</style>
