<!-- eslint-disable vue/no-v-html -->
<script setup lang="ts">
import { computed } from "vue";
import type { Component } from "vue";
import { useI18n } from "vue-i18n";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { FunctionZone as WeblinkFunctionZone } from "@weblink/ui-vue";

const props = defineProps<{ title: string; subtitle?: string; helpKey?: string; titleIcon?: Component }>();

const { t, locale } = useI18n();

const helpsZh = import.meta.glob("@/helps/zh/*.md", { eager: true, query: "?raw", import: "default" }) as Record<
  string,
  string
>;
const helpsEn = import.meta.glob("@/helps/en/*.md", { eager: true, query: "?raw", import: "default" }) as Record<
  string,
  string
>;

const helpHtml = computed(() => {
  if (!props.helpKey) return "<p>No help available.</p>";
  const dir = locale.value === "zh-CN" ? "zh" : "en";
  const modules = dir === "zh" ? helpsZh : helpsEn;
  const path = `/src/helps/${dir}/${props.helpKey}.md`;
  const raw =
    modules[path] ??
    `# ${props.title}\n\n${dir === "zh" ? "帮助内容即将提供。" : "Help content is coming soon."}`;
  const html = marked.parse(raw) as string;
  return DOMPurify.sanitize(html);
});
</script>

<template>
  <WeblinkFunctionZone :title="title" :subtitle="subtitle" :title-icon="titleIcon">
    <template v-if="helpKey" #help>
      <article class="help-content" v-html="helpHtml" />
    </template>
    <slot />
  </WeblinkFunctionZone>
</template>

<style scoped>
.help-content :deep(img),
.help-content :deep(table) {
  max-width: 100%;
}
.help-content :deep(h1),
.help-content :deep(h2),
.help-content :deep(h3) {
  margin: 0.5em 0;
  color: var(--text-primary);
}
.help-content :deep(p),
.help-content :deep(li) {
  color: var(--text-secondary);
}
.help-content :deep(code) {
  background: color-mix(in srgb, var(--surface-bg) 85%, var(--surface-contrast));
  padding: 0 4px;
  border-radius: 4px;
}
</style>
