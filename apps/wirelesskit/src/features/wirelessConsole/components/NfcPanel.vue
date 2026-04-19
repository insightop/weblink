<script setup lang="ts">
type NdefRec = { recordType: string; summary: string };

defineProps<{
  vm: {
    scanning: { value: boolean };
    busy: { value: boolean };
    error: { value: string | null };
    messages: { value: Array<{ id: string; ts: number; serial: string; vm: { recordCount: number; records: NdefRec[] } }> };
    writeMode: { value: "text" | "url" };
    writeText: { value: string };
    writeUrl: { value: string };
    start: () => Promise<void>;
    stop: () => void;
    write: () => Promise<void>;
    clear: () => void;
    formatTimeMs: (ts: number) => string;
  };
}>();
</script>

<template>
  <section class="card">
    <header class="card__head">
      <h2 class="card__title">NFC</h2>
      <span class="card__muted">Web NFC</span>
    </header>

    <div class="grid">
      <div class="row row--buttons">
        <div class="meta">
          <div class="name">{{ vm.scanning.value ? "扫描中" : "未扫描" }}</div>
          <div class="hint">
            {{ vm.messages.value.length }} 条
            <span v-if="vm.busy.value" class="dot">·</span>
            <span v-if="vm.busy.value">处理中…</span>
          </div>
        </div>

        <div class="btns">
          <button
            v-if="!vm.scanning.value"
            type="button"
            class="btn btn--primary"
            :disabled="vm.busy.value"
            @click="vm.start"
          >
            开始扫描
          </button>
          <button
            v-else
            type="button"
            class="btn btn--danger"
            :disabled="vm.busy.value"
            @click="vm.stop"
          >
            停止扫描
          </button>
          <button type="button" class="btn btn--ghost" :disabled="vm.busy.value" @click="vm.clear">
            清空记录
          </button>
        </div>
      </div>

      <div v-if="vm.error.value" class="err">{{ vm.error.value }}</div>

      <div class="write">
        <div class="write__head">
          <label class="lab">写入</label>
          <div class="seg">
            <button
              type="button"
              class="seg__btn"
              :class="{ 'seg__btn--on': vm.writeMode.value === 'text' }"
              @click="vm.writeMode.value = 'text'"
            >
              Text
            </button>
            <button
              type="button"
              class="seg__btn"
              :class="{ 'seg__btn--on': vm.writeMode.value === 'url' }"
              @click="vm.writeMode.value = 'url'"
            >
              URL
            </button>
          </div>
        </div>

        <input
          v-if="vm.writeMode.value === 'url'"
          class="inp"
          placeholder="https://example.com"
          :value="vm.writeUrl.value"
          @input="vm.writeUrl.value = ($event.target as HTMLInputElement).value"
        />
        <textarea
          v-else
          class="ta"
          rows="2"
          placeholder="写入文本"
          :value="vm.writeText.value"
          @input="vm.writeText.value = ($event.target as HTMLTextAreaElement).value"
        />

        <div class="write__actions">
          <button type="button" class="btn btn--primary" :disabled="vm.busy.value" @click="vm.write">
            写入
          </button>
        </div>
      </div>

      <div class="rx">
        <div class="rx__head">
          <div class="lab">读取记录</div>
          <div class="rx__meta">最新在上</div>
        </div>
        <div class="rx__list">
          <div v-if="vm.messages.value.length === 0" class="muted">暂无记录</div>
          <div v-for="m in [...vm.messages.value].slice().reverse()" :key="m.id" class="msg">
            <div class="msg__meta">
              <span class="msg__ts">{{ vm.formatTimeMs(m.ts) }}</span>
              <span class="msg__sn">{{ m.serial }}</span>
              <span class="msg__cnt">{{ m.vm.recordCount }} rec</span>
            </div>
            <div v-for="(r, idx) in m.vm.records" :key="idx" class="rec">
              <span class="rec__t">{{ r.recordType }}</span>
              <span class="rec__s">{{ r.summary }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: rgba(255, 255, 255, 0.04);
  padding: 0.75rem;
}
.card__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}
.card__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
}
.card__muted {
  color: var(--color-muted);
  font-size: 0.85rem;
}
.grid {
  margin-top: 0.6rem;
  display: grid;
  gap: 0.65rem;
}
.row--buttons {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
}
.lab {
  color: var(--color-muted);
  font-size: 12px;
}
.btns {
  display: inline-flex;
  gap: 0.45rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.btn {
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text);
  border-radius: 12px;
  padding: 0.45rem 0.7rem;
  cursor: pointer;
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn--primary {
  border-color: rgba(110, 168, 254, 0.4);
  background: rgba(110, 168, 254, 0.14);
}
.btn--danger {
  border-color: rgba(255, 107, 107, 0.35);
  background: rgba(255, 107, 107, 0.12);
}
.btn--ghost {
  background: transparent;
}
.meta .name {
  font-weight: 700;
}
.meta .hint {
  color: var(--color-muted);
  font-size: 12px;
  margin-top: 2px;
}
.dot {
  margin: 0 0.3rem;
}
.err {
  border: 1px solid rgba(255, 107, 107, 0.28);
  background: rgba(255, 107, 107, 0.12);
  padding: 0.55rem 0.65rem;
  border-radius: 12px;
  color: rgba(255, 255, 255, 0.9);
}
.write {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.14);
  border-radius: 12px;
  padding: 0.6rem;
}
.write__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.seg {
  display: inline-flex;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  overflow: hidden;
}
.seg__btn {
  border: none;
  background: transparent;
  color: var(--color-muted);
  padding: 0.35rem 0.6rem;
  cursor: pointer;
}
.seg__btn--on {
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-text);
}
.inp,
.ta {
  margin-top: 0.5rem;
  width: 100%;
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text);
  border-radius: 12px;
  padding: 0.5rem 0.6rem;
}
.ta {
  resize: vertical;
}
.write__actions {
  margin-top: 0.5rem;
  display: flex;
  justify-content: flex-end;
}
.rx {
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.14);
  border-radius: 12px;
  overflow: hidden;
}
.rx__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.45rem 0.6rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.rx__meta {
  color: var(--color-muted);
  font-size: 12px;
}
.rx__list {
  max-height: 280px;
  overflow: auto;
  padding: 0.6rem;
  display: grid;
  gap: 0.5rem;
}
.muted {
  color: var(--color-muted);
  font-size: 13px;
}
.msg {
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  border-radius: 12px;
  padding: 0.5rem 0.55rem;
}
.msg__meta {
  display: flex;
  gap: 0.5rem;
  color: var(--color-muted);
  font-size: 12px;
}
.rec {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 0.5rem;
  margin-top: 0.35rem;
}
.rec__t {
  color: var(--color-muted);
  font-family: var(--font-mono);
  font-size: 12px;
}
.rec__s {
  font-family: var(--font-mono);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

