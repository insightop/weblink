import { computed } from "vue";

export function useSecureContext() {
  return computed(() => {
    if (typeof window === "undefined") {
      return true;
    }
    return window.isSecureContext;
  });
}
