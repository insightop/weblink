/** Resolved UI locales supported by vue-i18n messages. */
export type AppLocale = "zh-CN" | "en-US";

/** Map browser language tags to app locale; default en-US. */
export function resolveBrowserLocale(): AppLocale {
  const list =
    typeof navigator !== "undefined" && Array.isArray(navigator.languages) && navigator.languages.length > 0
      ? navigator.languages
      : typeof navigator !== "undefined" && navigator.language
        ? [navigator.language]
        : ["en-US"];

  for (const tag of list) {
    const lower = tag.toLowerCase();
    if (lower === "zh-cn" || lower.startsWith("zh-hans") || lower.startsWith("zh")) {
      return "zh-CN";
    }
  }
  return "en-US";
}
