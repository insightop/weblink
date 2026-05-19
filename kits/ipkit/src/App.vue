<script setup lang="ts">
import {
  darkTheme,
  NConfigProvider,
  useOsTheme,
  zhCN,
  dateZhCN,
  type GlobalThemeOverrides,
} from "naive-ui";
import { computed } from "vue";
import { RouterView } from "vue-router";
import AppShell from "@/shell/AppShell.vue";
import BrowserCapabilityBanner from "@/shell/BrowserCapabilityBanner.vue";

const osTheme = useOsTheme();
const theme = computed(() => (osTheme.value === "dark" ? darkTheme : null));
const naiveLocale = zhCN;
const naiveDateLocale = dateZhCN;

const themeOverrides = computed<GlobalThemeOverrides>(() => {
  if (osTheme.value === "dark") {
    return {
      common: {
        primaryColor: "#3b82f6",
        primaryColorHover: "#60a5fa",
        primaryColorPressed: "#2563eb",
      },
    };
  }
  return {
    common: {
      primaryColor: "#2563eb",
      primaryColorHover: "#3b82f6",
      primaryColorPressed: "#1d4ed8",
    },
  };
});
</script>

<template>
  <NConfigProvider
    :theme="theme"
    :theme-overrides="themeOverrides"
    :locale="naiveLocale"
    :date-locale="naiveDateLocale"
  >
    <AppShell>
      <BrowserCapabilityBanner />
      <RouterView />
    </AppShell>
  </NConfigProvider>
</template>
