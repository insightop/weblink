<script lang="ts">
  import { cn, type WithElementRef } from "$lib/utils";
  import type { HTMLInputAttributes } from "svelte/elements";
  import { Badge } from "$lib/components/ui/badge";

  type Props = WithElementRef<
    Omit<HTMLInputAttributes, "type" | "value"> & {
      id?: string;
      value?: number;
      min?: number | null;
      max?: number | null;
      placeholder?: string;
      display?: "auto" | "dec" | "hex";
      uppercaseHex?: boolean;
      class?: string;
      syncWhileFocused?: boolean;
    }
  >;

  let {
    ref = $bindable<HTMLInputElement | null>(null),
    id = undefined,
    value = $bindable<number>(0),
    min = null,
    max = null,
    placeholder = "e.g. 16 or 0x10",
    display = "auto",
    uppercaseHex = true,
    class: className,
    syncWhileFocused = false,
    ...rest
  }: Props = $props();

  // internal edit string + parsed number
  let s = $state(String(value));
  let parsed: number | null = $state(value);
  let isFocused = $state(false);

  const toHex = (n: number) =>
    "0x" + (uppercaseHex ? n.toString(16).toUpperCase() : n.toString(16));

  // dynamic base for behavior (empty -> none; 0x... -> hex; digits -> dec)
  const base = $derived(() => {
    const t = s.trim();
    if (t === "") return "none" as const;
    if (/^0x$/i.test(t) || /^0x[0-9a-f]*$/i.test(t)) return "hex" as const;
    if (/^[0-9]+$/.test(t)) return "dec" as const;
    return "none" as const;
  });

  function parseNum(str: string): number | null {
    const t = str.trim();
    if (t === "") return null;
    if (/^0x[0-9a-f]+$/i.test(t)) return parseInt(t, 16);
    if (/^[0-9]+$/.test(t)) return parseInt(t, 10);
    return null;
  }

  // user -> parent
  $effect(() => {
    const n = parseNum(s);
    if (n == null) {
      parsed = null;
      return;
    }
    if ((min != null && n < min) || (max != null && n > max)) {
      parsed = null;
      return;
    }
    parsed = n;
    if (n !== value) value = n;
  });

  // parent -> input (don’t fight during typing)
  $effect(() => {
    if (isFocused && !syncWhileFocused) return;
    const current = parseNum(s);
    if (current === value) return;

    if (display === "hex") s = toHex(value);
    else if (display === "dec") s = String(value);
    else s = base() === "hex" ? toHex(value) : String(value);
  });

  function normalize() {
    if (parsed == null) return;
    if (display === "hex" || (display === "auto" && base() === "hex"))
      s = toHex(parsed);
    else s = String(parsed);
  }

  function onFocus() {
    isFocused = true;
  }
  function onBlur() {
    isFocused = false;
    normalize();
  }

  // Minimal input filter
  // Reads the native <input> value from the composed path to avoid wrapper staleness
  function onInput(e: Event) {
    const path = (e as any).composedPath?.() as EventTarget[] | undefined;
    const el =
      (path?.find((n) => n instanceof HTMLInputElement) as
        | HTMLInputElement
        | undefined) || (e.target as HTMLInputElement | null);
    if (!el) return;

    let t = el.value;

    const ps = parseNum(s);
    // Clamp numbers not to go past max
    if (ps != null && max !== null && ps > max) {
      s = t.slice(0, -1); // remove last char if it exceeds max
      return;
    }

    // deleting last digit -> "0"
    if (t === "") {
      s = "0";
      return;
    }

    // lone x/X -> start hex
    if (/^[xX]$/.test(t)) {
      s = "0x";
      return;
    }

    // "0" + digit -> remove leading zero
    if (/^0[0-9]$/.test(t)) {
      s = String(parseInt(t, 10)); // "01" -> "1"
      return;
    }

    // hex path
    if (/^0[xX]/.test(t)) {
      const rest = t.slice(2).replace(/[^0-9a-fA-F]/g, "");
      s = "0x" + (uppercaseHex ? rest.toUpperCase() : rest);
      return;
    }

    // decimal path: digits only; no leading zeros (keep lone "0")
    const digits = t.replace(/[^0-9]/g, "");
    s = digits === "" ? "0" : String(parseInt(digits, 10));
  }
</script>

<div class="relative inline-flex items-center">
  <input
    bind:this={ref}
    {id}
    data-slot="input"
    class={cn(
      "border-input bg-background selection:bg-primary dark:bg-input/30 selection:text-primary-foreground ring-offset-background placeholder:text-muted-foreground shadow-xs flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base outline-none transition-[color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
      "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
      "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
      className
    )}
    type="text"
    inputmode="text"
    autocapitalize="off"
    autocomplete="off"
    spellcheck="false"
    aria-invalid={parsed === null && s.trim() !== "" ? "true" : undefined}
    bind:value={s}
    oninput={onInput}
    onfocus={onFocus}
    onblur={onBlur}
    {placeholder}
    {...rest}
  />

  <!-- Right-side helper: shows detected base and both representations -->
  <div
    class="pointer-events-none absolute right-2 flex items-center gap-2 text-xs"
  >
    {#if base() !== "none"}
      <Badge variant="secondary" class="py-0 px-1 text-[10px]"
        >{base().toUpperCase()}</Badge
      >
    {/if}

    {#if parsed !== null}
      <span class="text-muted-foreground whitespace-nowrap"
        >{base() == "hex" ? parsed : toHex(parsed)}</span
      >
    {:else if s.trim() !== ""}
      <span class="text-destructive whitespace-nowrap">invalid</span>
    {/if}
  </div>
</div>

<style>
  /* ensure the helper has room; pr-28 on the input handles this */
</style>
