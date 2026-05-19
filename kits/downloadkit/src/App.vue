<script setup lang="ts">
import { computed, watch } from "vue";
import BrowserCapabilityOverlay from "@/shell/BrowserCapabilityOverlay.vue";
import { useUiStore } from "@/stores/ui.store";
import {
  darkTheme,
  dateEnUS,
  dateZhCN,
  enUS,
  NConfigProvider,
  useOsTheme,
  zhCN,
  type GlobalThemeOverrides,
} from "naive-ui";
import { useI18n } from "vue-i18n";
import { detectBrowserCapabilities } from "@/plugins/capabilities";
import { evaluateBrowserSupport } from "@/plugins/browserSupport";

const osTheme = useOsTheme();
const { locale } = useI18n();
const uiStore = useUiStore();

const browserSupport = computed(() =>
  evaluateBrowserSupport(
    detectBrowserCapabilities(),
    typeof navigator !== "undefined" ? navigator.userAgent : "",
    typeof navigator !== "undefined" ? navigator.platform : "",
  ),
);

const needsCapabilityOverlay = computed(() => browserSupport.value.needsCapabilityOverlay);

watch(
  () => uiStore.effectiveLocale,
  (v) => {
    locale.value = v;
  },
  { immediate: true },
);
const theme = computed(() => (osTheme.value === "dark" ? darkTheme : null));
const naiveLocale = computed(() => (locale.value === "zh-CN" ? zhCN : enUS));
const naiveDateLocale = computed(() => (locale.value === "zh-CN" ? dateZhCN : dateEnUS));
const themeOverrides = computed<GlobalThemeOverrides>(() => {
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
    :theme-overrides="themeOverrides"
  >
    <div
      class="app-shell"
      :class="{ 'app-shell--blocked': needsCapabilityOverlay }"
    >
      <RouterView />
    </div>
    <BrowserCapabilityOverlay
      v-if="needsCapabilityOverlay"
      :platform-kind="browserSupport.platformKind"
      :browser-marketing-key="browserSupport.browserMarketingKey"
    />
  </NConfigProvider>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
}
.app-shell--blocked {
  pointer-events: none;
  user-select: none;
}
</style>
