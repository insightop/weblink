<script setup lang="ts">
import { NCard, NText, NSpace, NTag, NButton } from "naive-ui";
import { computed } from "vue";
import { useRouter } from "vue-router";
import { detectCapabilities } from "@/infrastructure/browser/detectCapabilities";
import { globalIpToolRegistry } from "@/tools/registry";

const router = useRouter();
const caps = computed(() => detectCapabilities());

const tools = computed(() => globalIpToolRegistry.listAll().filter((t) => t.id !== "home"));
</script>

<template>
  <NSpace vertical size="large" style="width: 100%">
    <div>
      <NText tag="h1" style="font-size: 22px; font-weight: 700">概览</NText>
      <NText depth="3" style="display: block; margin-top: 8px">
        浏览器内可用的网络协议调试能力（非 ICMP/原始 UDP；WebRTC 详见 webrtckit）。
      </NText>
    </div>

    <NCard title="当前环境">
      <NSpace>
        <NTag :type="caps.secureContext ? 'success' : 'warning'">
          安全上下文: {{ caps.secureContext ? "是" : "否" }}
        </NTag>
        <NTag :type="caps.fetch ? 'success' : 'default'">fetch</NTag>
        <NTag :type="caps.webSocket ? 'success' : 'default'">WebSocket</NTag>
        <NTag :type="caps.webTransport ? 'success' : 'default'">WebTransport</NTag>
      </NSpace>
    </NCard>

    <div class="grid">
      <NCard v-for="t in tools" :key="t.id" :title="t.label" size="small" class="tool-card">
        <NSpace vertical>
          <NText depth="3">
            {{ t.isSupported(caps) ? "可用" : "当前环境不可用或已从侧栏隐藏" }}
          </NText>
          <NButton
            type="primary"
            secondary
            :disabled="!t.isSupported(caps)"
            @click="router.push(t.path)"
          >
            打开
          </NButton>
        </NSpace>
      </NCard>
    </div>
  </NSpace>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}
.tool-card {
  min-height: 140px;
}
</style>
