<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { NText } from "naive-ui";

const props = defineProps<{
  labelKey: string;
  helpKey?: string;
  required?: boolean;
}>();

const { t } = useI18n();

const labelText = computed(() => t(props.labelKey));
const helpText = computed(() => (props.helpKey ? t(props.helpKey) : ""));
</script>

<template>
  <div class="form-field-row">
    <div class="form-field-meta">
      <NText class="form-field-label">
        {{ labelText }}
        <span
          v-if="required"
          class="form-field-required"
          aria-hidden="true"
        >*</span>
      </NText>
      <NText
        v-if="helpText"
        depth="3"
        class="form-field-help"
      >
        {{ helpText }}
      </NText>
    </div>
    <div class="form-field-control">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.form-field-row {
  display: grid;
  grid-template-columns: minmax(120px, 38%) 1fr;
  gap: 12px 16px;
  align-items: start;
}
@media (max-width: 640px) {
  .form-field-row {
    grid-template-columns: 1fr;
  }
}
.form-field-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.form-field-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.form-field-required {
  color: var(--error-500);
  margin-left: 2px;
}
.form-field-help {
  font-size: 12px;
  line-height: 1.35;
}
.form-field-control {
  min-width: 0;
  width: 100%;
}
</style>
