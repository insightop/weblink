<script setup lang="ts">
import { NForm, NFormItem, NInput, NSelect, NSpace, NButton } from "naive-ui";
import { computed } from "vue";
import { useHttpLabStore } from "../stores/httpLab.store";

const store = useHttpLabStore();

const methodOptions = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"].map((m) => ({
  label: m,
  value: m,
}));

const canSend = computed(() => !store.loading);

const emit = defineEmits<{ send: [] }>();
</script>

<template>
  <NForm label-placement="top" label-width="auto">
    <NSpace vertical size="large" style="width: 100%">
      <NSpace>
        <NFormItem label="方法" style="min-width: 140px">
          <NSelect v-model:value="store.method" :options="methodOptions" />
        </NFormItem>
        <NFormItem label="URL" style="flex: 1">
          <NInput v-model:value="store.url" type="text" placeholder="https://..." />
        </NFormItem>
      </NSpace>
      <NFormItem label="请求头（每行 Key: Value）">
        <NInput
          v-model:value="store.headersText"
          type="textarea"
          placeholder="Content-Type: application/json"
          :autosize="{ minRows: 4, maxRows: 12 }"
        />
      </NFormItem>
      <NFormItem label="请求体（GET/HEAD 将忽略）">
        <NInput
          v-model:value="store.bodyText"
          type="textarea"
          placeholder="JSON 或纯文本"
          :autosize="{ minRows: 4, maxRows: 20 }"
        />
      </NFormItem>
      <NButton type="primary" :disabled="!canSend" :loading="store.loading" @click="emit('send')">
        发送
      </NButton>
    </NSpace>
  </NForm>
</template>
