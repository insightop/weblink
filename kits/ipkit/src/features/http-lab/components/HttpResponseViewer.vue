<script setup lang="ts">
import { NAlert, NCard, NDescriptions, NDescriptionsItem, NInput, NTag, NSpace } from "naive-ui";
import { computed } from "vue";
import type { FetchWithMetricsResult } from "../../../infrastructure/net/fetchWithMetrics";

const props = defineProps<{
  result: FetchWithMetricsResult | null;
  error: string | null;
}>();

const statusColor = computed(() => {
  if (!props.result) {
    return "default";
  }
  const s = props.result.summary.status;
  if (s >= 200 && s < 300) {
    return "success";
  }
  if (s >= 400) {
    return "error";
  }
  return "warning";
});
</script>

<template>
  <div class="viewer">
    <NAlert v-if="error" type="error" style="margin-bottom: 12px">{{ error }}</NAlert>

    <NCard v-if="result" title="响应" size="small">
      <NSpace vertical size="medium">
        <NSpace align="center">
          <NTag :type="statusColor" size="large"
            >{{ result.summary.status }} {{ result.summary.statusText }}</NTag
          >
          <span class="muted">{{ result.timingLine }}</span>
        </NSpace>
        <NDescriptions bordered size="small" :column="1" label-style="width: 120px">
          <NDescriptionsItem label="最终 URL">{{ result.summary.url }}</NDescriptionsItem>
          <NDescriptionsItem label="类型">{{ result.summary.type }}</NDescriptionsItem>
          <NDescriptionsItem label="重定向">{{
            result.summary.redirected ? "是" : "否"
          }}</NDescriptionsItem>
        </NDescriptions>
        <div>
          <div class="section-title">响应头</div>
          <NInput
            readonly
            type="textarea"
            :value="
              result.summary.headers.map((h) => `${h.name}: ${h.value}`).join('\n') || '(empty)'
            "
            :autosize="{ minRows: 4, maxRows: 16 }"
          />
        </div>
        <div>
          <div class="section-title">
            响应体
            <span v-if="result.summary.bodyTruncated" class="muted">（已截断展示）</span>
          </div>
          <NInput
            readonly
            type="textarea"
            :value="result.summary.bodyText"
            :autosize="{ minRows: 8, maxRows: 28 }"
          />
        </div>
      </NSpace>
    </NCard>
  </div>
</template>

<style scoped>
.viewer {
  margin-top: 8px;
}
.section-title {
  font-weight: 600;
  margin-bottom: 8px;
}
.muted {
  color: var(--n-text-color-3);
  font-size: 13px;
}
</style>
