<script setup lang="ts">
import { NButton, NCard, NSpace, NTag, NThing, NDivider } from "naive-ui";
import { computed } from "vue";
import { useRouter } from "vue-router";
import { KIT_REGISTRY } from "@/config/kitRegistry";

const router = useRouter();

const rows = computed(() =>
  KIT_REGISTRY.map((k) => ({
    ...k,
    ready: k.prodUrl !== "",
  })),
);

function navigateToKit(id: string) {
  router.push(`/${id}`);
}
</script>

<template>
  <div class="page">
    <header class="hero">
      <h1 class="title">Weblink</h1>
      <p class="subtitle">浏览器端硬件调试工具集合</p>
    </header>
    <main class="grid">
      <NCard v-for="row in rows" :key="row.id" :title="row.title" size="small" class="card">
        <NThing>
          <template #header>
            <NSpace align="center" :size="8">
              <span>{{ row.description }}</span>
              <NTag size="small" type="info" round>{{ row.stack }}</NTag>
            </NSpace>
          </template>
          <NSpace vertical :size="12">
            <NButton
              v-if="row.ready"
              type="primary"
              secondary
              @click="navigateToKit(row.id)"
            >
              Open
            </NButton>
            <NButton v-else disabled type="primary" secondary>
              Coming Soon
            </NButton>
          </NSpace>
        </NThing>
      </NCard>
    </main>
    <NDivider />
    <footer class="foot">
      <span class="muted">Monorepo · <code>pnpm dev</code></span>
    </footer>
  </div>
</template>

<style scoped>
.page {
  max-width: 960px;
  margin: 0 auto;
  padding: 32px 20px 48px;
}
.hero {
  margin-bottom: 28px;
}
.title {
  margin: 0 0 8px;
  font-size: 1.75rem;
  color: var(--text-primary);
}
.subtitle {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.95rem;
}
.grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
}
.card {
  background: var(--surface-bg);
  border: 1px solid var(--border-default);
}
.foot {
  text-align: center;
}
.muted {
  font-size: 12px;
  color: var(--text-muted);
}
code {
  font-size: 0.85em;
}
</style>
