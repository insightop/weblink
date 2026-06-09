/**
 * @weblink/bridge — Vue Composable
 *
 * Provides a simple interface for kits to push state, events, and config
 * to the bridge storage via IPC. In web mode (noop adapter), all calls
 * are silently ignored — zero performance cost.
 *
 * Usage:
 * ```ts
 * const { pushEvent, pushConfig } = useKitDataBridge('serialkit', reactiveState)
 * ```
 */

import { type Ref, watch } from "vue"
import { DataBridgeRendererApi } from "./api.js"

// ─── Shared singleton ──────────────────────────────────────────────

let sharedApi: DataBridgeRendererApi | null = null

function getApi(): DataBridgeRendererApi {
  if (!sharedApi) {
    sharedApi = new DataBridgeRendererApi()
  }
  return sharedApi
}

// ─── Lightweight debounce ──────────────────────────────────────────

function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  ms: number,
): T & { cancel(): void } {
  let timer: ReturnType<typeof setTimeout> | null = null
  const debounced = (...args: unknown[]) => {
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn(...args)
    }, ms)
  }
  debounced.cancel = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }
  return debounced as T & { cancel(): void }
}

// ─── Composable ────────────────────────────────────────────────────

export function useKitDataBridge(
  kitKey: string,
  reactiveState?: Ref<Record<string, unknown>> | Record<string, unknown>,
) {
  const api = getApi()
  const instanceId = "default"

  // Register the kit schema on first use
  // (fire-and-forget — noop in web mode)
  void api.kitRegister({
    kitKey,
    displayName: kitKey,
    description: "",
    version: 1,
    stateKeys: [],
    eventTypes: [],
  })

  // Debounced state push (100ms)
  const debouncedPushState = debounce(
    (state: Record<string, unknown>) => {
      void api.pushState(kitKey, instanceId, state)
    },
    100,
  )

  // Watch reactive state changes and auto-sync
  if (reactiveState) {
    watch(
      () => reactiveState,
      (newState) => {
        debouncedPushState(newState)
      },
      { deep: true },
    )
  }

  return {
    /** Push an event to the log (fire-and-forget) */
    pushEvent(type: string, payload: Record<string, unknown>) {
      void api.appendEvent(kitKey, instanceId, type, payload)
    },

    /** Push configuration update (fire-and-forget) */
    pushConfig(config: Record<string, unknown>) {
      void api.pushConfig(kitKey, config)
    },
  }
}
