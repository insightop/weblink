<script setup lang="ts">
import { computed, ref } from "vue";
import { CopyOutline } from "@vicons/ionicons5";
import { useI18n } from "vue-i18n";
import chromeLogoUrl from "@browser-logos/chrome/chrome.svg?url";
import edgeLogoUrl from "@browser-logos/edge/edge.svg?url";
import ArcBrandIcon from "@/shell/browser/ArcBrandIcon.vue";
import {
  buildExternalBrowserLinks,
  normalizeHttpPageUrl,
  type PlatformKind,
} from "@weblink/utils/browser";
import { UI_Z_INDEX } from "@weblink/utils/ui";

import type { BrowserMarketingKey } from "@/plugins/browserSupport";

const props = defineProps<{
  platformKind: PlatformKind;
  browserMarketingKey: BrowserMarketingKey;
}>();

const { t } = useI18n();
const copyStatus = ref<"idle" | "copied" | "failed">("idle");

const displayName = computed(() =>
  t(`browser.names.${props.browserMarketingKey}`),
);

const overlayTitle = computed(() =>
  t("browser.overlay.titleWithName", { name: displayName.value }),
);

const overlayBody = computed(() =>
  t("browser.overlay.bodyWithName", { name: displayName.value }),
);

const pageUrlForSchemes = computed(() => {
  if (typeof window === "undefined") return "";
  return normalizeHttpPageUrl(window.location.href) ?? "";
});

const pageUrlDisplay = computed(() =>
  typeof window !== "undefined" ? window.location.href : "",
);

const links = computed(() =>
  typeof window !== "undefined"
    ? buildExternalBrowserLinks(window.location.href, props.platformKind)
    : [],
);

const chromeHref = computed(
  () => links.value.find((l) => l.id === "chrome")?.href ?? "#",
);
const edgeHref = computed(
  () => links.value.find((l) => l.id === "edge")?.href ?? "#",
);
const arcHref = computed(
  () => links.value.find((l) => l.id === "arc")?.href ?? "#",
);

async function copyPageUrl(): Promise<void> {
  const url = pageUrlDisplay.value;
  if (!url) return;

  try {
    await navigator.clipboard.writeText(url);
    copyStatus.value = "copied";
    return;
  } catch {
    /* fall through */
  }

  try {
    const ta = document.createElement("textarea");
    ta.value = url;
    ta.setAttribute("readonly", "true");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (ok) {
      copyStatus.value = "copied";
      return;
    }
  } catch {
    /* fall through */
  }

  copyStatus.value = "failed";
}

function openExternalBrowser(href: string): void {
  if (!href || href === "#") return;
  const a = document.createElement("a");
  a.href = href;
  a.rel = "noopener noreferrer";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
</script>

<template>
  <Teleport to="body">
    <div
      class="cap-root"
      role="dialog"
      aria-modal="true"
      :aria-label="overlayTitle"
      :style="{ zIndex: UI_Z_INDEX.browserCapabilityOverlay }"
    >
      <div class="cap-scrim" aria-hidden="true" />
      <section class="cap-panel">
        <h2 class="cap-title">
          {{ overlayTitle }}
        </h2>
        <p class="cap-body">
          {{ overlayBody }}
        </p>

        <p v-if="!pageUrlForSchemes" class="cap-url-warning">
          {{ t("browser.overlay.invalidPageUrlForSchemes") }}
        </p>

        <div class="cap-tiles">
          <button
            type="button"
            class="cap-tile"
            :disabled="!pageUrlForSchemes"
            @click="openExternalBrowser(chromeHref)"
          >
            <img
              :src="chromeLogoUrl"
              alt=""
              class="cap-tile-icon cap-tile-icon--logo"
              width="40"
              height="40"
            />
            <span class="cap-tile-caption">{{
              t("browser.tileCaption.chrome")
            }}</span>
          </button>

          <button
            type="button"
            class="cap-tile"
            :disabled="!pageUrlForSchemes"
            @click="openExternalBrowser(edgeHref)"
          >
            <img
              :src="edgeLogoUrl"
              alt=""
              class="cap-tile-icon cap-tile-icon--logo"
              width="40"
              height="40"
            />
            <span class="cap-tile-caption">{{
              t("browser.tileCaption.edge")
            }}</span>
          </button>

          <button
            type="button"
            class="cap-tile"
            :disabled="!pageUrlForSchemes"
            @click="openExternalBrowser(arcHref)"
          >
            <ArcBrandIcon class="cap-tile-icon" />
            <span class="cap-tile-caption">{{
              t("browser.tileCaption.arc")
            }}</span>
          </button>

          <button type="button" class="cap-tile" @click="copyPageUrl">
            <CopyOutline class="cap-tile-icon cap-tile-icon--ion" />
            <span class="cap-tile-caption">{{
              t("browser.tileCaption.copy")
            }}</span>
          </button>
        </div>

        <p
          v-if="copyStatus === 'copied'"
          class="cap-copy-feedback cap-copy-feedback--ok"
        >
          {{ t("browser.overlay.copied") }}
        </p>
        <p
          v-else-if="copyStatus === 'failed'"
          class="cap-copy-feedback cap-copy-feedback--err"
        >
          {{ t("browser.overlay.copyFailed") }}
        </p>
        <p class="cap-hint">
          {{ t("browser.overlay.openHint") }}
        </p>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.cap-root {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: auto;
  padding: 16px;
}
.cap-scrim {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--surface-contrast) 28%, transparent);
  backdrop-filter: blur(12px) saturate(1.05);
  box-shadow: inset 0 0 80px
    color-mix(in srgb, var(--surface-contrast) 12%, transparent);
}
@supports not (backdrop-filter: blur(1px)) {
  .cap-scrim {
    background: color-mix(in srgb, var(--surface-contrast) 38%, transparent);
  }
}
.cap-panel {
  position: relative;
  z-index: 1;
  width: min(560px, 100%);
  max-height: min(92vh, 720px);
  overflow: auto;
  padding: 20px 22px;
  border-radius: 14px;
  background: var(--surface-bg);
  border: 1px solid var(--border-default);
  box-shadow: var(--shadow-soft);
  text-align: left;
}
.cap-title {
  margin: 0 0 10px;
  font-size: 18px;
  line-height: 1.25;
  color: var(--text-primary);
}
.cap-body {
  margin: 0 0 12px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-secondary);
}
.cap-url-block {
  margin: 0 0 14px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-secondary);
}
.cap-url-label {
  display: block;
  margin-bottom: 4px;
  color: var(--text-muted);
}
.cap-url-value {
  display: block;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 12px;
  word-break: break-all;
  white-space: pre-wrap;
  background: color-mix(in srgb, var(--surface-contrast) 6%, transparent);
  border: 1px solid var(--border-default);
  color: var(--text-primary);
}
.cap-url-warning {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--warning-500, #d97706);
}
.cap-tiles {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
@media (max-width: 520px) {
  .cap-tiles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.cap-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  margin: 0;
  padding: 14px 10px 12px;
  cursor: pointer;
  border-radius: 12px;
  border: 1px solid var(--border-default);
  background: color-mix(in srgb, var(--surface-contrast) 4%, transparent);
  color: inherit;
  font: inherit;
  text-align: center;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}
.cap-tile:hover:not(:disabled) {
  background: color-mix(in srgb, var(--surface-contrast) 8%, transparent);
  border-color: var(--border-strong, var(--border-default));
}
.cap-tile:focus-visible {
  outline: 2px solid var(--primary-color, #2563eb);
  outline-offset: 2px;
}
.cap-tile:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
.cap-tile-icon {
  flex-shrink: 0;
}
.cap-tile-icon--logo {
  object-fit: contain;
}
.cap-tile-icon--ion {
  width: 40px;
  height: 40px;
  color: var(--text-primary);
}
.cap-tile-caption {
  font-size: 12px;
  line-height: 1.35;
  color: var(--text-secondary);
}
.cap-hint {
  margin: 14px 0 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-muted);
}
.cap-copy-feedback {
  margin: 12px 0 0;
  font-size: 13px;
}
.cap-copy-feedback--ok {
  color: var(--success-500);
}
.cap-copy-feedback--err {
  color: var(--error-500);
}
</style>
