<script setup lang="ts">
import { computed } from "vue";
import { NButton, NCheckbox, NIcon, NPopover } from "naive-ui";
import {
  ChevronBackOutline,
  DocumentTextOutline,
  FunnelOutline,
  ShareSocialOutline,
} from "@vicons/ionicons5";
import { LucideBroomIcon } from "../../../shared/icons/lucideBroomIcon";
import { useI18n } from "vue-i18n";
import { LogConsole } from "@weblink/ui-vue";
import { useFlasherStore } from "../stores/flasher.store";
import type { LogEntry, LogLevel } from "../types/log";
import { exportLogsJson } from "../services/logExport";
import { LOG_LEVELS, getLogLevelPresentation } from "../presentation/logLevelPresentation";

function levelLabelKey(level: LogLevel): string {
  return getLogLevelPresentation(level).i18nKey;
}

const { t } = useI18n();

const props = defineProps<{
  logs: LogEntry[];
  expanded: boolean;
}>();
const emit = defineEmits<{ collapse: [] }>();
const store = useFlasherStore();
const levels = computed(() => [...LOG_LEVELS] as LogLevel[]);

const isLevelActive = (level: LogLevel): boolean => store.activeLogLevels.includes(level);

const onToggleLevel = (level: LogLevel): void => {
  store.toggleLogLevel(level);
};

const onExport = (): void => {
  exportLogsJson(props.logs, "flasher-logs");
};
</script>

<template>
  <aside
    v-if="props.expanded"
    class="sidebar"
  >
    <NButton
      class="collapse-trigger"
      tertiary
      size="small"
      @click="emit('collapse')"
    >
      <span class="collapse-inner">
        <NIcon
          :component="ChevronBackOutline"
          :size="16"
        />
        <span>{{ t("log.hide") }}</span>
      </span>
    </NButton>
    <header class="head">
      <div class="title-block">
        <NIcon
          :component="DocumentTextOutline"
          :size="18"
          class="title-icon"
        />
        <h3 class="title-text">
          {{ t("log.title") }}
        </h3>
      </div>
    </header>
    <div class="content">
      <div class="filter-block">
        <div class="toolbar">
          <NPopover
            trigger="click"
            placement="bottom-start"
            :show-arrow="true"
          >
            <template #trigger>
              <NButton
                quaternary
                size="small"
                class="tool-btn filter-trigger"
                :aria-label="t('log.filterLevels')"
              >
                <span class="btn-inner">
                  <NIcon
                    :component="FunnelOutline"
                    :size="18"
                  />
                </span>
              </NButton>
            </template>
            <template #default>
              <div class="level-filter">
                <label
                  v-for="level in levels"
                  :key="level"
                  class="filter-row"
                >
                  <span
                    class="level-dot"
                    :style="{ backgroundColor: getLogLevelPresentation(level).colorVar }"
                  />
                  <NIcon
                    :component="getLogLevelPresentation(level).icon"
                    :size="14"
                  />
                  <span class="filter-label">{{ t(levelLabelKey(level)) }}</span>
                  <NCheckbox
                    :checked="isLevelActive(level)"
                    @update:checked="onToggleLevel(level)"
                  />
                </label>
              </div>
            </template>
          </NPopover>
          <NButton
            secondary
            size="small"
            class="tool-btn"
            @click="store.clearLogs()"
          >
            <span class="btn-inner">
              <NIcon
                :component="LucideBroomIcon"
                :size="18"
              />
              <span>{{ t("log.clear") }}</span>
            </span>
          </NButton>
          <NButton
            secondary
            size="small"
            class="tool-btn"
            @click="onExport"
          >
            <span class="btn-inner">
              <NIcon
                :component="ShareSocialOutline"
                :size="18"
              />
              <span>{{ t("log.export") }}</span>
            </span>
          </NButton>
        </div>
      </div>
      <LogConsole
        :logs="props.logs"
        :empty-text="t('log.empty')"
        :get-level-label="(level) => t(levelLabelKey(level))"
      />
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 100%;
  min-width: 0;
  height: 100%;
  background: var(--surface-bg);
  color: var(--text-primary);
  border-left: 1px solid var(--border-default);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  align-content: start;
  justify-items: stretch;
  position: relative;
}
.collapse-trigger {
  position: absolute;
  top: 12px;
  left: -44px;
  border-radius: 10px 0 0 10px;
  height: 72px;
  width: 38px;
  z-index: 5;
}
.collapse-inner {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 11px;
  line-height: 1;
}
.head {
  padding: 12px 12px 12px 10px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  border-bottom: 1px solid var(--border-default);
}
.title-block {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.title-icon {
  flex-shrink: 0;
  color: var(--text-primary);
  opacity: 0.9;
}
.title-text {
  margin: 0;
  font-size: 14px;
  color: var(--text-primary);
  text-align: left;
}
.content {
  padding: 10px;
  display: grid;
  gap: 0;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 0;
}
.filter-block {
  padding-bottom: 10px;
  margin-bottom: 10px;
  border-bottom: 1px solid var(--border-default);
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.tool-btn :deep(.n-button__content) {
  gap: 6px;
}
.btn-inner {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.level-filter {
  min-width: 220px;
  padding: 4px 2px;
  display: grid;
  gap: 6px;
}
.filter-row {
  display: grid;
  grid-template-columns: 8px 16px 1fr auto;
  gap: 8px;
  align-items: center;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer;
  background: color-mix(in srgb, var(--surface-bg) 88%, transparent);
}
.filter-row:hover {
  background: color-mix(in srgb, var(--brand-500) 14%, transparent);
}
.level-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.filter-label {
  font-size: 12px;
}
</style>
