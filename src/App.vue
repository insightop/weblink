<script setup>
const tabs = [
  { path: '/', label: '首页' },
  { path: '/hid', label: 'HID' },
  { path: '/serial', label: '串口' },
  { path: '/stlink', label: 'ST-Link' },
  { path: '/usbdfu', label: 'USB DFU' },
  { path: '/daplink', label: 'DAPLink' },
  { path: '/camera', label: '摄像头' },
  { path: '/microphone', label: '麦克风' },
  { path: '/bluetooth', label: '蓝牙' },
  { path: '/about', label: '关于' },
]
</script>

<template>
  <div>
    <nav class="tab-bar">
      <router-link
        v-for="tab in tabs"
        :key="tab.path"
        :to="tab.path"
        class="tab"
        active-class="active"
      >
        {{ tab.label }}
      </router-link>
    </nav>
    <div class="tab-content">
      <router-view />
    </div>
  </div>
</template>

<style>
.tab-bar {
  display: flex;
  border-bottom: 1px solid #eee;
  background: #fafafa;
}
.tab {
  padding: 12px 24px;
  text-decoration: none;
  color: #333;
}
.tab.active {
  border-bottom: 2px solid #42b983;
  color: #42b983;
  font-weight: bold;
}
.tab-content {
  padding: 24px;
}
</style>
