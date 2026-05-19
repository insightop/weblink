import { createI18n } from "vue-i18n";
import zhCN from "@/locales/zh-CN.json";
import enUS from "@/locales/en-US.json";
import { resolveBrowserLocale } from "@/i18n/locale";

const fallbackLocale = "en-US";

export const i18n = createI18n({
  legacy: false,
  locale: resolveBrowserLocale(),
  fallbackLocale,
  messages: {
    "zh-CN": zhCN,
    "en-US": enUS,
  },
});
