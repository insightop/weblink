import { onUnmounted } from "vue";

/**
 * 用于单次异步任务的中止控制；组件卸载时自动 abort。
 */
export function useAbortableTask() {
  let controller: AbortController | null = null;

  function abort(): void {
    controller?.abort();
    controller = null;
  }

  function createSignal(): AbortSignal {
    abort();
    controller = new AbortController();
    return controller.signal;
  }

  onUnmounted(() => {
    abort();
  });

  return { createSignal, abort };
}
