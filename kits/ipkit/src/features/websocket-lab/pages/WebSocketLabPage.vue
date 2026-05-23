<script setup lang="ts">
import { NButton, NCard, NInput, NSpace, NText, NAlert } from "naive-ui";
import { ref } from "vue";
import WsMessageLog from "../components/WsMessageLog.vue";
import { useWsLabStore } from "../stores/wsLab.store";

const store = useWsLabStore();
const outgoing = ref("");

function send(): void {
  store.sendText(outgoing.value);
  outgoing.value = "";
}
</script>

<template>
  <NSpace vertical size="large" style="width: 100%">
    <div>
      <NText tag="h1" style="font-size: 22px; font-weight: 700">WebSocket</NText>
      <NText depth="3" style="display: block; margin-top: 8px">
        默认示例为公共 echo 服务，仅用于连通性验证；生产环境请使用自有 wss 端点。
      </NText>
    </div>

    <NAlert v-if="store.lastError" type="error">{{ store.lastError }}</NAlert>

    <NCard title="连接">
      <NSpace vertical style="width: 100%">
        <NInput v-model:value="store.url" placeholder="wss://..." />
        <NSpace>
          <NButton v-if="!store.connected" type="primary" @click="store.connect">连接</NButton>
          <NButton v-else secondary type="error" @click="store.disconnect">断开</NButton>
          <NButton quaternary @click="store.clearLog">清空日志</NButton>
        </NSpace>
      </NSpace>
    </NCard>

    <NCard title="发送文本">
      <NSpace vertical style="width: 100%">
        <NInput
          v-model:value="outgoing"
          type="textarea"
          placeholder="输入要发送的文本"
          :autosize="{ minRows: 2, maxRows: 8 }"
          :disabled="!store.connected"
        />
        <NButton :disabled="!store.connected" type="primary" @click="send">发送</NButton>
      </NSpace>
    </NCard>

    <NCard title="消息（最新在上）">
      <WsMessageLog :entries="store.messages" />
    </NCard>
  </NSpace>
</template>
