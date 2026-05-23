<script setup lang="ts">
import { NButton, NCard, NInput, NSelect, NSpace, NText, NAlert } from "naive-ui";
import { computed } from "vue";
import { DNS_JSON_TYPES, type DnsJsonType } from "../../../domain/doh/buildDnsJsonUrl";
import { DOH_PRESETS, useDohLabStore } from "../stores/dohLab.store";
import { useAbortableTask } from "../../../shared/composables/useAbortController";

const store = useDohLabStore();
const { createSignal } = useAbortableTask();

const presetOptions = computed(() => DOH_PRESETS.map((p) => ({ label: p.label, value: p.id })));

const typeOptions = computed(() =>
  DNS_JSON_TYPES.map((t) => ({ label: t, value: t as DnsJsonType })),
);

async function runQuery(): Promise<void> {
  const signal = createSignal();
  await store.query(signal);
}

const prettyJson = computed(() => {
  if (!store.lastRaw) {
    return "";
  }
  try {
    return JSON.stringify(JSON.parse(store.lastRaw), null, 2);
  } catch {
    return store.lastRaw;
  }
});
</script>

<template>
  <NSpace vertical size="large" style="width: 100%">
    <div>
      <NText tag="h1" style="font-size: 22px; font-weight: 700">DNS over HTTPS（dns-json）</NText>
      <NText depth="3" style="display: block; margin-top: 8px">
        使用公共解析器的 JSON API。若浏览器报 CORS 错误，请换解析器或在受控环境部署同域代理。
      </NText>
    </div>

    <NAlert v-if="store.lastError" type="error">{{ store.lastError }}</NAlert>

    <NCard title="查询">
      <NSpace vertical style="width: 100%">
        <NSelect v-model:value="store.presetId" :options="presetOptions" placeholder="解析器" />
        <NInput v-model:value="store.name" placeholder="域名，例如 example.com" />
        <NSelect v-model:value="store.type" :options="typeOptions" />
        <NText depth="3">请求 URL：{{ store.resolverBase() }}?name=…&type=…</NText>
        <NButton type="primary" :loading="store.loading" @click="runQuery">查询</NButton>
        <NText v-if="store.statusLine">{{ store.statusLine }}</NText>
      </NSpace>
    </NCard>

    <NCard v-if="prettyJson" title="JSON 响应">
      <NInput
        readonly
        type="textarea"
        :value="prettyJson"
        :autosize="{ minRows: 12, maxRows: 36 }"
      />
    </NCard>
  </NSpace>
</template>
