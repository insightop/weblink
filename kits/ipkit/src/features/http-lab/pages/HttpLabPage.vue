<script setup lang="ts">
import { NCard, NText, NSpace } from "naive-ui";
import HttpRequestEditor from "../components/HttpRequestEditor.vue";
import HttpResponseViewer from "../components/HttpResponseViewer.vue";
import { useHttpLabStore } from "../stores/httpLab.store";
import { useAbortableTask } from "../../../shared/composables/useAbortController";

const store = useHttpLabStore();
const { createSignal } = useAbortableTask();

async function handleSend(): Promise<void> {
  const signal = createSignal();
  await store.send(signal);
}
</script>

<template>
  <NSpace vertical size="large" style="width: 100%">
    <div>
      <NText tag="h1" style="font-size: 22px; font-weight: 700">HTTP 调试</NText>
      <NText depth="3" style="display: block; margin-top: 8px">
        基于 fetch。跨域请求受 CORS 约束；访问局域网设备可能触发 Private Network Access 预检。
      </NText>
    </div>

    <NCard title="请求">
      <HttpRequestEditor @send="handleSend" />
    </NCard>

    <HttpResponseViewer :result="store.lastResult" :error="store.lastError" />
  </NSpace>
</template>
