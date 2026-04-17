<script setup>
import KitIcon from '@/features/kits/components/KitIcon.vue'

const props = defineProps({
  tabs: { type: Array, required: true },
  activeTabId: { type: String, default: null },
})

const emit = defineEmits(['activate', 'close', 'reload', 'closeAll'])

function onCloseAllClick() {
  if (!props.tabs.length) return
  const ok = window.confirm('确认关闭所有标签页？')
  if (!ok) return
  emit('closeAll')
}
</script>

<template>
  <div class="strip">
    <div class="strip__tabs">
      <div
        v-for="t in props.tabs"
        :key="t.id"
        class="tab"
        :class="{ 'tab--active': t.id === props.activeTabId }"
        @click="emit('activate', t.id)"
      >
        <div class="tab__lead">
          <KitIcon :icon="t.icon" :name="t.title" :size="14" class="tab__icon" />
          <button
            v-if="t.id === props.activeTabId"
            type="button"
            class="tab__hover tab__hover--reload"
            title="刷新"
            @click.stop="emit('reload', t.id)"
          >
            <span class="tab__hoverGlyph" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M20 12a8 8 0 0 1-13.66 5.66"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
                <path
                  d="M4 12a8 8 0 0 1 13.66-5.66"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
                <path
                  d="M18.6 7.2H21V4.8"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M3 19.2v-2.4h2.4"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </span>
          </button>
        </div>
        <span class="tab__title">{{ t.title }}</span>
        <span v-if="t.instanceIndex && t.instanceIndex > 1" class="tab__badge">
          {{ t.instanceIndex }}
        </span>
        <button
          type="button"
          class="tab__btn tab__btn--close"
          title="关闭"
          @click.stop="emit('close', t.id)"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M7 7 17 17M17 7 7 17"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>

      <button
        v-if="props.tabs.length > 0"
        type="button"
        class="action action--danger"
        title="关闭所有标签页"
        @click="onCloseAllClick"
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M7 7 17 17M17 7 7 17"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.strip {
  display: flex;
  padding: 8px 8px 0;
  background: #f3f3f3;
  border-bottom: 1px solid #e5e5e5;
  gap: 0;
  align-items: stretch;
}
.strip__tabs {
  flex: 1;
  min-width: 0;
  display: flex;
  overflow-x: auto;
  overflow-y: hidden;
  align-items: flex-end;
  height: 40px;
}
.tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px;
  border-radius: 10px 10px 0 0;
  border: 1px solid transparent;
  border-bottom: 0;
  background: transparent;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  color: #666;
  position: relative;
}
.tab--active {
  background: #fff;
  color: #111;
  border-color: #e5e5e5;
  margin-bottom: -1px;
  box-shadow: 0 -1px 0 rgba(0, 0, 0, 0.02);
}
.tab:not(.tab--active)::after {
  content: '';
  position: absolute;
  right: -1px;
  top: 10px;
  bottom: 10px;
  width: 1px;
  background: rgba(0, 0, 0, 0.12);
}
.tab:not(.tab--active):last-child::after {
  display: none;
}
.tab__title {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tab__lead {
  position: relative;
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}
.tab__icon {
  flex: 0 0 auto;
  opacity: 0.9;
  transition: opacity 0.12s ease;
}
.tab__hover {
  position: absolute;
  inset: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  color: rgba(0, 0, 0, 0.55);
  border-radius: 8px;
  transition: opacity 0.12s ease, background 0.12s ease, color 0.12s ease;
  font-size: 16px;
  line-height: 1;
}
.tab__hoverGlyph {
  display: inline-block;
  transform-origin: 50% 50%;
}
.tab__hoverGlyph svg {
  width: 16px;
  height: 16px;
  display: block;
}
.tab--active:hover .tab__icon {
  opacity: 0;
}
.tab--active:hover .tab__hover {
  opacity: 1;
  pointer-events: auto;
}
.tab__hover--reload:hover {
  color: rgba(37, 99, 235, 0.95);
  background: rgba(37, 99, 235, 0.10);
}
.tab--active:hover .tab__hover--reload .tab__hoverGlyph {
  animation: weblink-rotate 0.55s ease-out 1;
}
@keyframes weblink-rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
.tab__badge {
  font-size: 12px;
  line-height: 1;
  padding: 3px 6px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.06);
  color: rgba(0, 0, 0, 0.6);
}
.tab--active .tab__badge {
  background: rgba(0, 0, 0, 0.05);
  color: rgba(0, 0, 0, 0.7);
}
.tab__btn {
  border: none;
  background: transparent;
  cursor: pointer;
  line-height: 1;
  width: 22px;
  height: 22px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgba(0, 0, 0, 0.55);
  border-radius: 8px;
}
.tab__btn svg {
  width: 16px;
  height: 16px;
  display: block;
}
.tab--active .tab__btn {
  color: rgba(0, 0, 0, 0.7);
}
.tab__btn:hover {
  background: rgba(0, 0, 0, 0.06);
}
.tab__btn:active {
  background: rgba(0, 0, 0, 0.1);
}
.tab__btn--close:hover {
  color: rgba(220, 38, 38, 0.95);
  background: rgba(220, 38, 38, 0.10);
}
.tab__btn--close {
  border-radius: 999px;
}

.action {
  flex: 0 0 auto;
  margin-left: 6px;
  margin-bottom: 2px;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: rgba(255, 255, 255, 0.75);
  color: rgba(0, 0, 0, 0.65);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.action svg {
  width: 16px;
  height: 16px;
}
.action--danger {
  border-color: rgba(0, 0, 0, 0.12);
  background: rgba(255, 255, 255, 0.6);
  color: rgba(0, 0, 0, 0.5);
}
.action--danger:hover {
  border-color: rgba(220, 38, 38, 0.35);
  background: rgba(220, 38, 38, 0.10);
  color: rgba(220, 38, 38, 0.92);
}
</style>
