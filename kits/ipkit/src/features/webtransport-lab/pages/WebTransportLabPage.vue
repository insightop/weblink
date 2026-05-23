<script setup lang="ts">
import { NButton, NCard, NInput, NSpace, NText, NAlert, NTag } from "naive-ui";
import { computed } from "vue";
import { useWtLabStore } from "../stores/wtLab.store";

const store = useWtLabStore();

const tagType = computed(() => {
  const p = store.lastProbe;
  if (!p) {
    return "default";
  }
  if (!p.supported) {
    return "warning";
  }
  return p.connected ? "success" : "error";
});
</script>

<template>
  <NSpace vertical size="large" style="width: 100%">
    <div>
      <NText tag="h1" style="font-size: 22px; font-weight: 700">WebTransport</NText>
      <NText depth="3" style="display: block; margin-top: 8px">
        尝试与 HTTPS 端点建立 WebTransport 会话（握手成功后立即关闭）。用于验证浏览器与网络路径。
      </NText>
    </div>

    <NCard title="探测">
      <NSpace vertical style="width: 100%">
        <NInput v-model:value="store.url" placeholder="https://…" />
        <NButton type="primary" :loading="store.loading" @click="store.probe">握手探测</NButton>
        <div v-if="store.lastProbe">
          <NSpace align="center">
            <NTag :type="tagType">
              {{ store.lastProbe.supported ? "API 可用" : "API 不可用" }}
            </NTag>
            <NTag
              v-if="store.lastProbe.supported"
              :type="store.lastProbe.connected ? 'success' : 'error'"
            >
              {{ store.lastProbe.connected ? "握手成功" : "握手失败" }}
            </NTag>
          </NSpace>
          <NAlert v-if="store.lastProbe.message" style="margin-top: 12px" type="info">
            {{ store.lastProbe.message }}
          </NAlert>
        </div>
      </NSpace>
    </NCard>
  </NSpace>
</template>
