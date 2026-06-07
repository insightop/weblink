<script setup lang="ts">
import { NConfigProvider, darkTheme, useOsTheme, enUS, dateEnUS } from "naive-ui";
import { computed } from "vue";
import { RouterView } from "vue-router";
import { SpeedInsights } from "@vercel/speed-insights/vue";

const osTheme = useOsTheme();
const theme = computed(() => (osTheme.value === "dark" ? darkTheme : null));
</script>

<template>
  <NConfigProvider :theme="theme" :locale="enUS" :date-locale="dateEnUS">
    <RouterView />
    <SpeedInsights />
  </NConfigProvider>
</template>
