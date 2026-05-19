<script setup lang="ts">
import DevicePermissionHint from "@/features/capturekit/components/DevicePermissionHint.vue";
import CameraPanel from "@/features/capturekit/components/CameraPanel.vue";
import MicrophonePanel from "@/features/capturekit/components/MicrophonePanel.vue";
import SpeakerPanel from "@/features/capturekit/components/SpeakerPanel.vue";
import { useEnumerateDevices } from "@/features/capturekit/composables/useEnumerateDevices";

const { devices, error, refresh: refreshDevices } = useEnumerateDevices();
</script>

<template>
  <div class="page">
    <header class="header">
      <h1 class="header__title">Capture Kit</h1>
      <p v-if="error" class="header__error">{{ error }}</p>
    </header>

    <DevicePermissionHint />

    <main class="grid">
      <CameraPanel :devices="devices" :refresh-devices="refreshDevices" />
      <MicrophonePanel :devices="devices" :refresh-devices="refreshDevices" />
      <SpeakerPanel :devices="devices" :refresh-devices="refreshDevices" />
    </main>
  </div>
</template>

<style scoped>
.page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1.5rem 1rem 2rem;
}
.header {
  margin-bottom: 1.25rem;
}
.header__title {
  margin: 0 0 0.5rem;
  font-size: 1.5rem;
  font-weight: 600;
}
.header__error {
  color: var(--color-danger);
  font-size: 0.85rem;
  margin: 0 0 0.5rem;
}
.grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr;
}

@media (min-width: 900px) {
  .grid {
    grid-template-columns: 1fr 1fr;
  }
  .grid > :first-child {
    grid-column: 1 / -1;
  }
}
</style>
