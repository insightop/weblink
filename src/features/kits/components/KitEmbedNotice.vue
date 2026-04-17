<script setup>
import { computed } from 'vue'

const props = defineProps({
  kitName: { type: String, required: true },
  baseUrl: { type: String, required: true },
})

const hint = computed(() => {
  return `无法在 weblink 内嵌打开「${props.kitName}」。\n\n最常见原因（目标站点的响应头限制）：\n1) X-Frame-Options: DENY / SAMEORIGIN\n2) Content-Security-Policy: frame-ancestors 未包含 weblink 域名\n\n解决方式（在 kit 的 Cloudflare Pages 增加 _headers）：\n/*\n  Content-Security-Policy: frame-ancestors 'self' https://weblink.pages.dev\n\n并避免使用 X-Frame-Options: DENY\n\n提示：如果 weblink 自己换了域名，请把 frame-ancestors 中的域名替换为实际域名。`
})
</script>

<template>
  <div class="notice">
    <div class="notice__title">嵌入失败（可能被安全策略拦截）</div>
    <pre class="notice__body">{{ hint }}</pre>
    <div class="notice__meta">目标地址：{{ baseUrl || '（尚未配置 baseUrl）' }}</div>
  </div>
</template>

<style scoped>
.notice {
  border: 1px solid #f1c40f;
  background: #fffdf0;
  border-radius: 12px;
  padding: 12px;
  color: #5c4b00;
}
.notice__title {
  font-weight: 700;
  margin-bottom: 6px;
}
.notice__body {
  margin: 0;
  white-space: pre-wrap;
  font-size: 12px;
  line-height: 1.5;
}
.notice__meta {
  margin-top: 8px;
  font-size: 12px;
  opacity: 0.85;
}
</style>
