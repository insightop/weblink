<script setup lang="ts">
import { NLayout, NLayoutSider, NLayoutContent, NMenu, NText, NDivider } from "naive-ui";
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { detectCapabilities } from "../infrastructure/browser/detectCapabilities";
import { globalIpToolRegistry } from "../tools/registry";

const route = useRoute();
const router = useRouter();
const caps = computed(() => detectCapabilities());

const menuOptions = computed(() => {
  return globalIpToolRegistry.listVisible(caps.value).map((t) => ({
    label: t.label,
    key: t.path,
  }));
});

const selectedKey = computed(() => route.path);

function handleMenuUpdate(key: string) {
  void router.push(key);
}
</script>

<template>
  <NLayout has-sider class="root-layout">
    <NLayoutSider
      bordered
      show-trigger
      collapse-mode="width"
      :collapsed-width="64"
      :width="220"
      content-style="display: flex; flex-direction: column; min-height: 100vh;"
    >
      <div class="brand">
        <NText strong>weblink-ipkit</NText>
      </div>
      <NDivider style="margin: 8px 0" />
      <NMenu :value="selectedKey" :options="menuOptions" @update:value="handleMenuUpdate" />
    </NLayoutSider>
    <NLayoutContent
      content-style="padding: 16px 20px; max-width: 1200px; margin: 0 auto; width: 100%;"
    >
      <slot />
    </NLayoutContent>
  </NLayout>
</template>

<style scoped>
.root-layout {
  min-height: 100vh;
}
.brand {
  padding: 16px 16px 0;
  font-size: 15px;
}
</style>
