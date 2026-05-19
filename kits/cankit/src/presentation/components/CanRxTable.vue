<script setup lang="ts">
import type { RxFrameRow } from "@/domain/can/types.js";
import { formatDataHex, formatHexId } from "@weblink/utils/hex";

defineProps<{
  rows: readonly RxFrameRow[];
}>();

defineEmits<{
  clear: [];
}>();
</script>

<template>
  <div class="panel">
    <div class="toolbar" style="justify-content: space-between; margin-bottom: 8px">
      <h2 style="margin: 0; font-size: 16px">接收</h2>
      <button type="button" class="btn" @click="$emit('clear')">清空</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>方向</th>
            <th>类型</th>
            <th>ID</th>
            <th>DLC</th>
            <th>数据</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.seq">
            <td class="mono">{{ r.seq }}</td>
            <td>{{ r.frame.direction === "rx" ? "RX" : "TX" }}</td>
            <td>{{ r.frame.extended ? "EXT" : "STD" }}</td>
            <td class="mono">{{ formatHexId(r.frame.id, r.frame.extended) }}</td>
            <td class="mono">{{ r.frame.dlc }}</td>
            <td class="mono">{{ formatDataHex(r.frame.data) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
