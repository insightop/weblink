<script setup lang="ts">
import WorkbenchView from "@/features/workbench/WorkbenchView.vue";
</script>

<template>
  <n-config-provider>
    <n-message-provider>
      <n-dialog-provider>
        <WorkbenchView />
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>
