<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import KitEmbedNotice from '@/features/kits/components/KitEmbedNotice.vue'

const DEFAULT_IFRAME_LOAD_TIMEOUT_MS = 4500

const props = defineProps({
  tab: { type: Object, required: true },
  kit: { type: Object, required: true },
})

const loading = ref(true)
const timedOut = ref(false)
let timer = 0

const src = computed(() => props.tab.url)

function armTimeout() {
  window.clearTimeout(timer)
  timedOut.value = false
  loading.value = true
  timer = window.setTimeout(() => {
    // 被 XFO/CSP 拦截时通常没有 onerror，这里用超时提示兜底
    timedOut.value = true
    loading.value = false
  }, DEFAULT_IFRAME_LOAD_TIMEOUT_MS)
}

function onLoad() {
  window.clearTimeout(timer)
  loading.value = false
  timedOut.value = false
}

watch(
  () => props.tab.url,
  () => {
    armTimeout()
  },
)

onMounted(() => {
  armTimeout()
})

onBeforeUnmount(() => {
  window.clearTimeout(timer)
})
</script>

<template>
  <div class="pane">
    <div class="pane__body">
      <KitEmbedNotice v-if="!src" :kit-name="kit.name" :base-url="kit.baseUrl" />
      <KitEmbedNotice v-else-if="timedOut" :kit-name="kit.name" :base-url="kit.baseUrl" />

      <iframe
        v-else
        class="frame"
        :src="src"
        title="kit-iframe"
        loading="eager"
        allow="serial; usb; hid; bluetooth; nfc; camera; microphone; display-capture; speaker-selection; clipboard-read; clipboard-write"
        @load="onLoad"
      />
    </div>

    <div v-if="loading && src && !timedOut" class="loading">加载中…</div>
  </div>
</template>

<style scoped>
.pane {
  height: 100%;
  min-height: 0;
  border: 0;
  border-radius: 0;
  overflow: hidden;
  background: #fff;
  position: relative;
}
.pane__body {
  height: 100%;
  background: #fff;
}
.frame {
  width: 100%;
  height: 100%;
  border: 0;
}
.loading {
  position: absolute;
  left: 12px;
  top: 10px;
  font-size: 12px;
  color: #666;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(0, 0, 0, 0.08);
  padding: 4px 8px;
  border-radius: 999px;
  backdrop-filter: blur(6px);
  pointer-events: none;
}
</style>
