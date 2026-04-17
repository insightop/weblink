<script setup>
import { computed, onMounted } from 'vue'
import { KIT_MODULES } from '@/features/kits/registry/kitModules'
import { useKitWorkspaceStore } from '@/stores/kitWorkspace'
import KitTabStrip from '@/features/kits/components/KitTabStrip.vue'
import KitIframePane from '@/features/kits/components/KitIframePane.vue'

const store = useKitWorkspaceStore()

onMounted(() => {
  store.ensureInitialized()
})

const activeTab = computed(() => store.activeTab)

function getKitTabs(kitKey) {
  return store.tabs
    .filter((t) => t.kitKey === kitKey)
    .slice()
    .sort((a, b) => (b.lastActiveAt ?? 0) - (a.lastActiveAt ?? 0))
}

const kitStats = computed(() => {
  /** @type {Record<string, {count:number, firstId:string|null}>} */
  const out = {}
  for (const m of KIT_MODULES) {
    const tabs = getKitTabs(m.key)
    out[m.key] = { count: tabs.length, firstId: tabs[0]?.id ?? null }
  }
  return out
})

function onKitCardClick(m) {
  if (!m.url) return
  const s = kitStats.value[m.key]
  if (s?.count > 0 && s.firstId) {
    store.setActive(s.firstId)
  } else {
    store.openTab(m.key)
  }
}

function onKitPlusClick(m) {
  if (!m.url) return
  store.openTab(m.key)
}
</script>

<template>
  <div class="shell">
    <aside class="sidebar">
      <div class="sidebar__head">
        <div class="sidebar__title">Weblink</div>
        <div class="sidebar__sub">基于 Web API 的调试工具集合</div>
      </div>

      <div class="sidebar__list">
        <div
          v-for="m in KIT_MODULES"
          :key="m.key"
          class="kit"
          :class="{
            'kit--disabled': !m.url,
            'kit--has': (kitStats[m.key]?.count ?? 0) > 0,
          }"
        >
          <button
            type="button"
            class="kit__main"
            :disabled="!m.url"
            @click="onKitCardClick(m)"
          >
            <div class="kit__head">
              <div class="kit__name">{{ m.name }}</div>
            </div>
            <div class="kit__desc">{{ m.desc }}</div>
          </button>

          <button
            type="button"
            class="kit__plus"
            title="新建实例"
            :disabled="!m.url"
            @click="onKitPlusClick(m)"
          >
            +
          </button>
        </div>
      </div>
    </aside>

    <main class="workspace">
      <div class="workspace__top">
        <KitTabStrip
          :tabs="store.tabs"
          :active-tab-id="store.activeTabId"
          @activate="store.setActive"
          @close="store.closeTab"
          @reload="store.reloadTab"
        />
      </div>

      <div class="workspace__body">
        <KitIframePane
          v-if="activeTab"
          :tab="activeTab"
          :kit="{ name: activeTab.title, baseUrl: activeTab.url }"
        />

        <div v-else class="placeholder">
          <div class="placeholder__card">
            <div class="placeholder__icon" aria-hidden="true">
              <svg viewBox="0 0 64 64" fill="none">
                <path
                  d="M10 16.5C10 13.462 12.462 11 15.5 11H48.5C51.538 11 54 13.462 54 16.5V44.5C54 47.538 51.538 50 48.5 50H15.5C12.462 50 10 47.538 10 44.5V16.5Z"
                  stroke="currentColor"
                  stroke-width="2"
                />
                <path
                  d="M16 20H48"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
                <path
                  d="M16 28H34"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
                <path
                  d="M16 36H30"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
            </div>
            <div class="placeholder__title">选择一个 Kit 开始</div>
            <div class="placeholder__text">从左侧点击即可打开工具页。</div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.shell {
  display: grid;
  grid-template-columns: 280px 1fr;
  width: 100%;
  height: 100%;
  gap: 0;
  border: 0;
  border-radius: 0;
  overflow: hidden;
  background: #fff;
}
.sidebar {
  border-right: 1px solid #eee;
  background: #fafafa;
  padding: 12px;
  overflow: auto;
}
.sidebar__head {
  padding: 6px 6px 10px;
}
.sidebar__title {
  font-weight: 900;
  font-size: 18px;
  letter-spacing: 0.2px;
}
.sidebar__sub {
  margin-top: 4px;
  font-size: 12px;
  color: #666;
}
.sidebar__list {
  display: grid;
  gap: 10px;
}
.kit {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 8px;
  text-align: left;
  border: 1px solid #f0f0f0;
  background: #fff;
  border-radius: 12px;
  padding: 8px 8px 8px 10px;
  transition: box-shadow 0.15s ease, transform 0.15s ease;
  position: relative;
}
.kit::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 12px;
  background: transparent;
}
.kit--has::before {
  background: rgba(66, 185, 131, 0.9);
}
.kit:hover:not(.kit--disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
}
.kit--disabled {
  opacity: 0.6;
}
.kit__main {
  border: none;
  background: transparent;
  padding: 0;
  margin: 0;
  text-align: left;
  cursor: pointer;
}
.kit__main:disabled {
  cursor: not-allowed;
}
.kit__head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.kit__name {
  font-weight: 700;
}
.kit__desc {
  margin-top: 4px;
  font-size: 12px;
  color: #666;
  line-height: 1.4;
}
.kit__plus {
  width: 24px;
  height: 24px;
  border-radius: 8px;
  border: 1px solid rgba(66, 185, 131, 0.28);
  background: rgba(66, 185, 131, 0.14);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  color: rgba(47, 125, 91, 1);
}
.kit__plus:hover:not(:disabled) {
  background: rgba(66, 185, 131, 0.22);
  border-color: rgba(66, 185, 131, 0.38);
}
.kit__plus:disabled {
  cursor: not-allowed;
}
.workspace {
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
}
.workspace__top {
  border-bottom: 0;
  padding: 0;
  background: #f3f3f3;
}
.workspace__body {
  flex: 1;
  min-height: 0;
  padding: 0;
  background: #fff;
}
.placeholder {
  height: 100%;
  display: grid;
  place-items: center;
  padding: 24px;
  background: linear-gradient(180deg, #ffffff 0%, #fbfbfb 100%);
}
.placeholder__card {
  width: 100%;
  max-width: 620px;
  border: 1px dashed #dcdcdc;
  border-radius: 16px;
  padding: 18px;
  background: #fff;
}
.placeholder__icon {
  width: 56px;
  height: 56px;
  margin-bottom: 10px;
  color: rgba(0, 0, 0, 0.14);
}
.placeholder__icon svg {
  width: 100%;
  height: 100%;
}
.placeholder__title {
  font-weight: 900;
  font-size: 16px;
  margin-bottom: 8px;
}
.placeholder__text {
  color: #666;
  font-size: 13px;
  line-height: 1.5;
  margin-top: 6px;
}
@media (max-width: 900px) {
  .shell {
    grid-template-columns: 1fr;
    height: 100%;
  }
  .sidebar {
    border-right: none;
    border-bottom: 1px solid #eee;
    max-height: none;
  }
}
</style>
