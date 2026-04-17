<script setup>
const props = defineProps({
  tabs: { type: Array, required: true },
  activeTabId: { type: String, default: null },
})

const emit = defineEmits(['activate', 'close', 'reload'])
</script>

<template>
  <div class="strip">
    <div
      v-for="t in props.tabs"
      :key="t.id"
      class="tab"
      :class="{ 'tab--active': t.id === props.activeTabId }"
      @click="emit('activate', t.id)"
    >
      <span class="tab__title">{{ t.title }}</span>
      <button type="button" class="tab__btn" title="刷新" @click.stop="emit('reload', t.id)">
        ↻
      </button>
      <button type="button" class="tab__btn" title="关闭" @click.stop="emit('close', t.id)">
        ×
      </button>
    </div>
  </div>
</template>

<style scoped>
.strip {
  display: flex;
  overflow: auto;
  padding: 8px 8px 0;
  background: #f3f3f3;
  border-bottom: 1px solid #e5e5e5;
}
.tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 10px 10px 0 0;
  border: 1px solid transparent;
  border-bottom: 0;
  background: transparent;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  color: #666;
}
.tab--active {
  background: #fff;
  color: #111;
  border-color: #e5e5e5;
  margin-bottom: -1px;
  box-shadow: 0 -1px 0 rgba(0, 0, 0, 0.02);
}
.tab__title {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tab__btn {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 2px 4px;
  color: inherit;
}
</style>
