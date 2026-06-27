import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * Node 22+ can expose `navigator` without a full browser `localStorage`.
 * @vue/devtools-kit treats that as a browser and calls localStorage.getItem → crash while loading vite.config.
 */
function ensureLocalStorageForDevtools() {
  const ls = globalThis.localStorage
  if (ls != null && typeof ls.getItem === 'function') return
  const store = new Map()
  const shim = {
    getItem: (key) => (store.has(String(key)) ? String(store.get(String(key))) : null),
    setItem: (key, value) => {
      store.set(String(key), String(value))
    },
    removeItem: (key) => {
      store.delete(String(key))
    },
    clear: () => {
      store.clear()
    },
    key: (index) => [...store.keys()][index] ?? null,
    get length() {
      return store.size
    },
  }
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    enumerable: true,
    writable: true,
    value: shim,
  })
}

// https://vite.dev/config/
export default defineConfig(async () => {
  const enableVueDevtools = process.env.VITE_VUE_DEVTOOLS === '1'
  if (enableVueDevtools) ensureLocalStorageForDevtools()
  const vueDevTools = enableVueDevtools ? (await import('vite-plugin-vue-devtools')).default : null

  return {
    plugins: [vue(), ...(vueDevTools ? [vueDevTools()] : [])],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      // 避免 devtools/overlay 这类插件异常时每次刷新都遮挡页面
      hmr: { overlay: false },
    },
  }
})
