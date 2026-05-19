<script lang="ts">
  import HexInput from './HexInput.svelte';

  type DisplayMode = 'auto' | 'dec' | 'hex';

  let {
    id = undefined as string | undefined,
    value = $bindable<number[]>([]),
    max = 0xFFFF,
    unique = false,
    placeholder = 'e.g. 16 0x10 42',
    display = 'auto' as DisplayMode,
    uppercaseHex = true,
    inputClass = '',
  } = $props();

  // numeric mirror for HexInput (it binds to numbers only)
  let token = $state(0);
  let inputEl = $state<HTMLInputElement | null>(null); // underlying <input> from HexInput
  const inputId = id ?? `hexstack-${Math.random().toString(36).slice(2)}`;

  const toHex = (n: number) => '0x' + (uppercaseHex ? n.toString(16).toUpperCase() : n.toString(16));

  function parseTokenString(str: string): number | null {
    const t = str.trim().replaceAll('_', '');
    let n: number | null = null;
    if (/^0x[0-9a-f]+$/i.test(t)) n = parseInt(t, 16);
    else if (/^-?\d+$/.test(t)) n = parseInt(t, 10);
    if (n == null || Number.isNaN(n)) return null;
    if (n < 0 || n > max) return null;
    return n;
  }

  function clearHexInput() {
    if (!inputEl) return;
    inputEl.value = '';
    // force HexInput to react to programmatic change
    inputEl.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  }

  function commitFromHex(): boolean {
    const raw = inputEl?.value ?? '';
    const n = parseTokenString(raw);
    if (n == null) return false;
    if (unique && value.includes(n)) { clearHexInput(); return true; }
    value = [...value, n];
    clearHexInput();
    requestAnimationFrame(() => inputEl?.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
    return true;
  }

  // eslint-disable-next-line
  function removeAt(i: number) {
    value = [...value.slice(0, i), ...value.slice(i + 1)];
    inputEl?.focus();
  }

  function restoreToken(n: number) {
    if (!inputEl) return;
    const str = display === 'hex' ? toHex(n) : display === 'dec' ? String(n) : String(n);
    inputEl.value = str;
    inputEl.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    queueMicrotask(() => {
      const len = inputEl!.value.length;
      inputEl!.setSelectionRange(len, len);
      inputEl!.focus();
    });
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === ' ' || e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitFromHex();
      return;
    }
    if (e.key === 'Backspace') {
      const v = inputEl?.value ?? '';
      if (v === '' || v === '0' || /^0x$/i.test(v)) {
        if (value.length) {
          const last = value[value.length - 1];
          value = value.slice(0, -1);
          restoreToken(last);
        }
        e.preventDefault();
      }
    }
  }

  function onPaste(e: ClipboardEvent) {
    const data = e.clipboardData?.getData('text') ?? '';
    if (!data) return;
    e.preventDefault();
    const toks = data.split(/[\s,]+/).map(t => t.trim()).filter(Boolean);
    let pushed = false;
    for (const tok of toks) {
      const n = parseTokenString(tok);
      if (n == null) { // hand partial to the HexInput
        if (inputEl) {
          inputEl.value = tok;
          inputEl.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        }
        return;
      }
      if (!unique || !value.includes(n)) {
        value = [...value, n];
        pushed = true;
      }
    }
    if (pushed) clearHexInput();
  }
</script>


  <!-- HexInput kept intact; styled via class prop to appear borderless if desired -->
  <HexInput
    bind:ref={inputEl}
    id={inputId}
    bind:value={token}
    max={max}
    display={display}
    uppercaseHex={uppercaseHex}
    placeholder={value.length ? '' : placeholder}
    class={`h-9 w-40 ${inputClass}`}  
    onkeydown={onKeydown}
    onpaste={onPaste}
  />
