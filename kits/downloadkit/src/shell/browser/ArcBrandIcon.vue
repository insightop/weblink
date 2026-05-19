<script setup lang="ts">
import { siArc } from "simple-icons";
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="40"
    height="40"
    viewBox="0 0 24 24"
    aria-hidden="true"
    class="brand-icon"
  >
    <path
      :fill="`#${siArc.hex}`"
      :d="siArc.path"
    />
  </svg>
</template>

<style scoped>
.brand-icon {
  display: block;
}
</style>
