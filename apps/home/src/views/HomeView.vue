<script setup lang="ts">
import { NButton, NCard, NSpace, NTag, NThing, NDivider } from "naive-ui";
import { computed } from "vue";

type KitEnvKey =
  | "VITE_KIT_SERIAL_URL"
  | "VITE_KIT_WIRELESS_URL"
  | "VITE_KIT_DOWNLOAD_URL"
  | "VITE_KIT_CAPTURE_URL"
  | "VITE_KIT_GNSS_URL"
  | "VITE_KIT_MODBUS_URL";

interface KitLink {
  id: string;
  title: string;
  description: string;
  envKey: KitEnvKey;
  stack?: string;
}

const kits: KitLink[] = [
  { id: "serial", title: "Serial Kit", description: "WebSerial console", envKey: "VITE_KIT_SERIAL_URL", stack: "Vue" },
  {
    id: "wireless",
    title: "Wireless Kit",
    description: "Bluetooth / NFC",
    envKey: "VITE_KIT_WIRELESS_URL",
    stack: "Vue",
  },
  {
    id: "download",
    title: "Download Kit",
    description: "Firmware flashing",
    envKey: "VITE_KIT_DOWNLOAD_URL",
    stack: "Vue",
  },
  {
    id: "capture",
    title: "Capture Kit",
    description: "Camera / mic",
    envKey: "VITE_KIT_CAPTURE_URL",
    stack: "Vue",
  },
  { id: "gnss", title: "GNSS Kit", description: "NMEA / GNSS", envKey: "VITE_KIT_GNSS_URL", stack: "Vanilla" },
  { id: "modbus", title: "Modbus Kit", description: "Modbus Web UI", envKey: "VITE_KIT_MODBUS_URL", stack: "Svelte" },
];

const env = import.meta.env;

function hrefFor(kit: KitLink): string {
  const v = env[kit.envKey];
  return typeof v === "string" && v.length > 0 ? v : "#";
}

const hasUrl = (kit: KitLink) => hrefFor(kit) !== "#";

const rows = computed(() =>
  kits.map((k) => ({
    ...k,
    href: hrefFor(k),
    ready: hasUrl(k),
  })),
);
</script>

<template>
  <div class="page">
    <header class="hero">
      <h1 class="title">Weblink</h1>
      <p class="subtitle">Browser-side tools — open each kit (configure URLs via <code>.env</code>).</p>
    </header>
    <main class="grid">
      <NCard v-for="row in rows" :key="row.id" :title="row.title" size="small" class="card">
        <NThing>
          <template #header>
            <NSpace align="center" :size="8">
              <span>{{ row.description }}</span>
              <NTag v-if="row.stack" size="small" type="info" round>{{ row.stack }}</NTag>
            </NSpace>
          </template>
          <NSpace vertical :size="12">
            <NButton
              tag="a"
              :href="row.href"
              :disabled="!row.ready"
              type="primary"
              secondary
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ row.ready ? "Open" : "Set env URL" }}
            </NButton>
          </NSpace>
        </NThing>
      </NCard>
    </main>
    <NDivider />
    <footer class="foot">
      <span class="muted">Monorepo · <code>pnpm --filter @weblink/home dev</code></span>
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
