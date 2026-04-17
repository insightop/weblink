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
  ensureLocalStorageForDevtools()
  const { default: vueDevTools } = await import('vite-plugin-vue-devtools')

  return {
    plugins: [vue(), vueDevTools()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})
