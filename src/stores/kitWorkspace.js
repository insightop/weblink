import { defineStore } from 'pinia'
import { KIT_MODULES } from '@/features/kits/registry/kitModules'

const STORAGE_KEY = 'weblink.kitWorkspace.v1'

function now() {
  return Date.now()
}

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function safeJsonParse(v) {
  try {
    return JSON.parse(v)
  } catch {
    return null
  }
}

function normalizeUrl(input) {
  const v = String(input ?? '').trim()
  if (!v) return ''
  try {
    return new URL(v).toString()
  } catch {
    return ''
  }
}

export const useKitWorkspaceStore = defineStore('kitWorkspace', {
  state: () => ({
    tabs: /** @type {Array<{id:string,kitKey:string,title:string,icon?:string,instanceIndex?:number,url:string,createdAt:number,lastActiveAt:number,reloadNonce:number,instanceId:string}>} */ ([]),
    activeTabId: /** @type {string|null} */ (null),
  }),

  getters: {
    activeTab(state) {
      return state.tabs.find((t) => t.id === state.activeTabId) ?? null
    },
  },

  actions: {
    restore() {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const data = safeJsonParse(raw)
      if (!data || typeof data !== 'object') return
      if (!Array.isArray(data.tabs)) return

      this.tabs = data.tabs
        .filter((t) => t && typeof t === 'object')
        .map((t) => ({
          id: String(t.id ?? createId('tab')),
          kitKey: String(t.kitKey ?? ''),
          title: String(t.title ?? 'Kit'),
          icon: typeof t.icon === 'string' ? t.icon : undefined,
          instanceIndex: Number(t.instanceIndex ?? 0) || 0,
          url: normalizeUrl(t.url),
          createdAt: Number(t.createdAt ?? now()),
          lastActiveAt: Number(t.lastActiveAt ?? now()),
          reloadNonce: Number(t.reloadNonce ?? 0),
          instanceId: String(t.instanceId ?? createId('inst')),
        }))
        .filter((t) => !!t.url)

      // 兼容旧数据：为缺失的 icon 从 kitModules 补齐
      for (const t of this.tabs) {
        if (t.icon) continue
        const meta = KIT_MODULES.find((m) => m.key === t.kitKey)
        if (meta?.icon) t.icon = meta.icon
      }

      // 兼容旧数据：为缺失的 instanceIndex 填充一个稳定序号（按创建时间）
      const ordered = this.tabs.slice().sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
      const counters = new Map()
      for (const t of ordered) {
        const cur = counters.get(t.kitKey) ?? 0
        const next = Math.max(cur + 1, t.instanceIndex || 0)
        counters.set(t.kitKey, next)
        if (!t.instanceIndex) t.instanceIndex = next
      }

      const candidate = typeof data.activeTabId === 'string' ? data.activeTabId : null
      this.activeTabId = this.tabs.some((t) => t.id === candidate) ? candidate : this.tabs[0]?.id ?? null
    },

    persist() {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ tabs: this.tabs, activeTabId: this.activeTabId }),
      )
    },

    ensureInitialized() {
      if (this.tabs.length) return
      this.restore()
    },

    openTab(kitKey) {
      const meta = KIT_MODULES.find((m) => m.key === kitKey)
      if (!meta) return
      const baseUrl = normalizeUrl(meta.url)
      if (!baseUrl) return

      const sameCount = this.tabs.filter((t) => t.kitKey === kitKey).length
      const id = createId('tab')
      const instanceId = createId(kitKey)
      const createdAt = now()

      const u = new URL(baseUrl)
      u.searchParams.set('weblinkInstance', instanceId)

      const tab = {
        id,
        kitKey,
        title: meta.name,
        icon: meta.icon,
        instanceIndex: sameCount + 1,
        url: u.toString(),
        createdAt,
        lastActiveAt: createdAt,
        reloadNonce: 0,
        instanceId,
      }

      this.tabs = [...this.tabs, tab]
      this.activeTabId = id
      this.persist()
    },

    setActive(tabId) {
      const tab = this.tabs.find((t) => t.id === tabId)
      if (!tab) return
      this.activeTabId = tabId
      tab.lastActiveAt = now()
      this.persist()
    },

    closeTab(tabId) {
      const idx = this.tabs.findIndex((t) => t.id === tabId)
      if (idx === -1) return
      const wasActive = this.activeTabId === tabId
      const nextTabs = this.tabs.slice(0, idx).concat(this.tabs.slice(idx + 1))
      this.tabs = nextTabs
      if (wasActive) {
        this.activeTabId = nextTabs[idx - 1]?.id ?? nextTabs[0]?.id ?? null
      }
      this.persist()
    },

    closeAllTabs() {
      if (!this.tabs.length) return
      this.tabs = []
      this.activeTabId = null
      this.persist()
    },

    reloadTab(tabId) {
      const tab = this.tabs.find((t) => t.id === tabId)
      if (!tab) return
      tab.reloadNonce = (tab.reloadNonce ?? 0) + 1
      const u = new URL(tab.url)
      u.searchParams.set('_t', String(tab.reloadNonce))
      tab.url = u.toString()
      this.persist()
    },
  },
})
