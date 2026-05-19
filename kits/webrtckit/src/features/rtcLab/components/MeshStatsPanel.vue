<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  peerStats: Record<string, { connectionState: string; iceConnectionState: string }>;
}>();

const rows = computed(() =>
  Object.entries(props.peerStats).map(([id, s]) => ({
    id,
    short: id.slice(0, 8),
    connectionState: s.connectionState,
    iceConnectionState: s.iceConnectionState,
  })),
);
</script>

<template>
  <section class="panel">
    <h2 class="panel__title">连接状态</h2>
    <p v-if="rows.length === 0" class="muted">尚无对等连接</p>
    <table v-else class="tbl">
      <thead>
        <tr>
          <th>Peer</th>
          <th>connection</th>
          <th>ICE</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in rows" :key="r.id">
          <td class="mono">{{ r.short }}…</td>
          <td>{{ r.connectionState }}</td>
          <td>{{ r.iceConnectionState }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.panel {
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.03);
}
.panel__title {
  margin: 0 0 0.5rem;
  font-size: 1rem;
}
.muted {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-muted);
}
.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}
th,
td {
  text-align: left;
  padding: 0.35rem 0.45rem;
  border-bottom: 1px solid var(--color-border);
}
.mono {
  font-family: var(--font-mono);
}
</style>
