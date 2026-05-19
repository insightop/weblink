import { defineStore } from "pinia";
import type { AppLocale } from "@/i18n/locale";
import { resolveBrowserLocale } from "@/i18n/locale";

export type LocaleMode = "auto" | AppLocale;

export const useUiStore = defineStore("ui", {
  state: (): { localeMode: LocaleMode } => ({
    localeMode: "auto",
  }),
  getters: {
    effectiveLocale(state): AppLocale {
      if (state.localeMode === "auto") return resolveBrowserLocale();
      return state.localeMode;
    },
  },
  actions: {
    setLocaleMode(mode: LocaleMode): void {
      this.localeMode = mode;
    },
  },
});
