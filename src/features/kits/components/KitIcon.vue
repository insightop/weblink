<script setup>
const props = defineProps({
  name: { type: String, default: '' },
  icon: { type: String, default: '' },
  size: { type: Number, default: 18 },
})

function common(svg) {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    d: svg,
  }
}

const ICONS = {
  serial: common(
    'M7 6.5h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Zm2 3h6M9 12h4M9 14.5h6',
  ),
  modbus: common(
    'M6.5 7.5h11a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2Zm2 3h7M8.5 13.5h5',
  ),
  gnss: common(
    'M12 3l2.2 6.2 6.3 2.3-6.3 2.3L12 20l-2.2-6.2-6.3-2.3 6.3-2.3L12 3Zm0 6v6',
  ),
  capture: common(
    'M8 7h8l1 2h2v9H5V9h2l1-2Zm4 4.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z',
  ),
  download: common('M13 2 5 14h7l-1 8 8-12h-7l1-8Z'),
  wireless: common(
    'M12 18.8a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Zm-4.2-2.5a6.2 6.2 0 0 1 8.4 0M5.1 13.5a10 10 0 0 1 13.8 0M2.7 10.3a13.5 13.5 0 0 1 18.6 0',
  ),
  webrtckit: common(
    'M15.2 10.4a3.2 3.2 0 1 0-6.4 0 3.2 3.2 0 0 0 6.4 0ZM12 4.5v2.2M12 17.3v2.2M4.5 12h2.2M17.3 12h2.2M6.6 6.6l1.6 1.6M15.8 15.8l1.6 1.6M6.6 17.4l1.6-1.6M15.8 6.2l1.6-1.6',
  ),
  flashkit: common(
    'M13 2 3 14h8l-1 8 10-12h-8l1-8Z',
  ),
  cankit: common(
    'M6 9.5h12M6 14.5h12M9.5 7v10M14.5 7v10M7 7h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z',
  ),
  ipkit: common(
    'M4.5 8h15v8h-15V8Zm2.5 2.5h10M7 12h10M7 15.5h10M9 8v8M15 8v8',
  ),
  vkvmkit: common(
    'M6 6h12a2 2 0 0 1 2 2v7H4V8a2 2 0 0 1 2-2Zm2 3h8M9 18h6M11 20h2',
  ),
}

const TONES = {
  serial: { fg: 'rgba(37, 99, 235, 0.95)', bg: 'rgba(37, 99, 235, 0.10)', bd: 'rgba(37, 99, 235, 0.20)' },
  modbus: { fg: 'rgba(124, 58, 237, 0.95)', bg: 'rgba(124, 58, 237, 0.10)', bd: 'rgba(124, 58, 237, 0.20)' },
  gnss: { fg: 'rgba(16, 185, 129, 0.95)', bg: 'rgba(16, 185, 129, 0.10)', bd: 'rgba(16, 185, 129, 0.20)' },
  capture: { fg: 'rgba(245, 158, 11, 0.95)', bg: 'rgba(245, 158, 11, 0.10)', bd: 'rgba(245, 158, 11, 0.22)' },
  download: { fg: 'rgba(71, 85, 105, 0.95)', bg: 'rgba(71, 85, 105, 0.10)', bd: 'rgba(71, 85, 105, 0.20)' },
  wireless: { fg: 'rgba(59, 130, 246, 0.95)', bg: 'rgba(59, 130, 246, 0.10)', bd: 'rgba(59, 130, 246, 0.20)' },
  webrtckit: { fg: 'rgba(34, 197, 94, 0.95)', bg: 'rgba(34, 197, 94, 0.10)', bd: 'rgba(34, 197, 94, 0.22)' },
  flashkit: { fg: 'rgba(168, 85, 247, 0.95)', bg: 'rgba(168, 85, 247, 0.10)', bd: 'rgba(168, 85, 247, 0.22)' },
  cankit: { fg: 'rgba(234, 88, 12, 0.95)', bg: 'rgba(234, 88, 12, 0.10)', bd: 'rgba(234, 88, 12, 0.22)' },
  ipkit: { fg: 'rgba(14, 165, 233, 0.95)', bg: 'rgba(14, 165, 233, 0.10)', bd: 'rgba(14, 165, 233, 0.22)' },
  vkvmkit: { fg: 'rgba(13, 148, 136, 0.95)', bg: 'rgba(13, 148, 136, 0.10)', bd: 'rgba(13, 148, 136, 0.22)' },
}

const iconSpec = ICONS[props.icon] ?? ICONS.download
const tone = TONES[props.icon] ?? TONES.download
</script>

<template>
  <span
    class="icon"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      background: tone.bg,
      borderColor: tone.bd,
      color: tone.fg,
    }"
    :title="name"
  >
    <svg
      :viewBox="iconSpec.viewBox"
      :width="Math.max(12, Math.round(size * 0.7))"
      :height="Math.max(12, Math.round(size * 0.7))"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        :d="iconSpec.d"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </span>
</template>

<style scoped>
.icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
}
</style>
