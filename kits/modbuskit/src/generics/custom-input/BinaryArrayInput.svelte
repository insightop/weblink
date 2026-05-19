<script lang="ts">
  type Props = {
    id?: string;
    value?: boolean[];
    placeholder?: string;
    class?: string;
    inputClass?: string;
    acceptBooleans?: boolean;
    buttons?: boolean;
  };

  let {
    id = undefined,
    value = $bindable<boolean[]>([]),
    placeholder = "0 or 1 (true/false)",
    class: className = "",
    inputClass = "",
    acceptBooleans = true,
    buttons = true,
  }: Props = $props();

  let s = $state("");
  let inputEl: HTMLInputElement | null = null;

  function parseToken(str: string): boolean | null {
    const t = str.trim().toLowerCase();
    if (t === "") return null;
    if (t === "0") return false;
    if (t === "1") return true;
    if (acceptBooleans) {
      if (["true", "t", "yes", "y", "on"].includes(t)) return true;
      if (["false", "f", "no", "n", "off"].includes(t)) return false;
    }
    return null;
  }

  function commitCurrent(): boolean {
    const b = parseToken(s);
    if (b === null) return false;
    value = [...value, b];
    s = "";
    return true;
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === " " || e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitCurrent();
      return;
    }
    if (e.key === "Backspace" && s.trim() === "") {
      if (value.length) {
        const last = value[value.length - 1];
        value = value.slice(0, -1);
        s = last ? "1" : "0";
        queueMicrotask(() => {
          inputEl?.focus();
          const len = s.length;
          inputEl?.setSelectionRange(len, len);
        });
        e.preventDefault();
      }
    }
  }

  function onPaste(e: ClipboardEvent) {
    const data = e.clipboardData?.getData("text") ?? "";
    if (!data) return;
    e.preventDefault();
    const toks = data
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    for (const tok of toks) {
      const b = parseToken(tok);
      if (b === null) {
        s = tok;
        inputEl?.focus();
        return;
      }
      value = [...value, b];
    }
    s = "";
  }

  function add(b: boolean) {
    value = [...value, b];
    queueMicrotask(() => inputEl?.focus());
  }
</script>

<label
  class={`flex items-center gap-2 rounded-md border bg-background px-2 py-1 text-sm shadow-sm focus-within:ring-2 focus-within:ring-ring ${className}`}
  aria-label="Boolean values"
  for={id}
>
  <input
    id={id}
    bind:this={inputEl}
    class={`flex-1 min-w-[6ch] border-0 bg-transparent p-0 outline-none placeholder:text-muted-foreground ${inputClass}`}
    type="text"
    inputmode="text"
    autocapitalize="off"
    autocomplete="off"
    spellcheck="false"
    bind:value={s}
    onkeydown={onKeydown}
    onpaste={onPaste}
    placeholder={value.length ? "" : placeholder}
  />

  {#if buttons}
    <span class="inline-flex gap-1">
      <button
        type="button"
        class="h-7 w-7 rounded-md border text-sm font-mono hover:bg-foreground/5"
        onclick={() => add(false)}>0</button
      >
      <button
        type="button"
        class="h-7 w-7 rounded-md border text-sm font-mono hover:bg-foreground/5"
        onclick={() => add(true)}>1</button
      >
    </span>
  {/if}
</label>
