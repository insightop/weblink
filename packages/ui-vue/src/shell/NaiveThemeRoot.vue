<script setup lang="ts">
import { computed } from "vue";
import {
  NConfigProvider,
  darkTheme,
  dateEnUS,
  dateZhCN,
  enUS,
  useOsTheme,
  zhCN,
  type GlobalTheme,
  type GlobalThemeOverrides,
} from "naive-ui";

const props = withDefaults(
  defineProps<{
    locale?: "zh-CN" | "en-US";
    themeOverrides?: GlobalThemeOverrides | null;
  }>(),
  { locale: "en-US" },
);

const osTheme = useOsTheme();

const theme = computed<GlobalTheme | null>(() => (osTheme.value === "dark" ? darkTheme : null));

const naiveLocale = computed(() => (props.locale === "zh-CN" ? zhCN : enUS));
const naiveDateLocale = computed(() => (props.locale === "zh-CN" ? dateZhCN : dateEnUS));

const mergedOverrides = computed<GlobalThemeOverrides>(() => {
  if (props.themeOverrides) return props.themeOverrides;
  if (osTheme.value === "dark") {
    return {
      common: {
        primaryColor: "#3b82f6",
        primaryColorHover: "#60a5fa",
        primaryColorPressed: "#2563eb",
        successColor: "#22c55e",
        successColorHover: "#4ade80",
        successColorPressed: "#16a34a",
        errorColor: "#ef4444",
        errorColorHover: "#f87171",
        errorColorPressed: "#dc2626",
      },
    };
  }
  return {
    common: {
      primaryColor: "#2563eb",
      primaryColorHover: "#3b82f6",
      primaryColorPressed: "#1d4ed8",
      successColor: "#16a34a",
      successColorHover: "#22c55e",
      successColorPressed: "#15803d",
      errorColor: "#dc2626",
      errorColorHover: "#ef4444",
      errorColorPressed: "#b91c1c",
    },
  };
});
</script>

<template>
  <NConfigProvider
    :theme="theme"
    :locale="naiveLocale"
    :date-locale="naiveDateLocale"
    :theme-overrides="mergedOverrides"
  >
    <slot />
  </NConfigProvider>
</template>
