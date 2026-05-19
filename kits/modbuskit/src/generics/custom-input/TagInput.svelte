<script lang="ts">
  type Props = {
    value?: string | null;
    placeholder?: string;
    id?: string;
    class?: string;
    inputClass?: string;
  };

  let {
    value = $bindable<string | null>(null),
    placeholder = "NAME_TABLE",
    id = undefined,
    class: className = "",
    inputClass = "",
  }: Props = $props();

  // internal: always a string for the real <input>
  let raw = $state<string>(value ?? "");

  function sanitize(str: string): string {
    let s = str
      .replace(/\s+/g, "_")
      .replace(/[^A-Za-z0-9_]/g, "")
      .toUpperCase();
    s = s.replace(/^[0-9]+/, ""); // no leading digits
    s = s.replace(/_{2,}/g, "_"); // collapse underscores
    return s;
  }

  // parent -> input (handles external resets like `newProfileId = null`)
  $effect(() => {
    const next = sanitize(value ?? "");
    if (raw !== next) raw = next;
  });

  // input -> parent (single source of truth for typing)
  function onInput(e: Event) {
    const el = e.target as HTMLInputElement;
    const next = sanitize(el.value);
    if (raw !== next) raw = next;
    const out = next === "" ? null : next;
    if (value !== out) value = out;
  }

  const pattern = "[A-Z_][A-Z0-9_]*";
  const title =
    "Use A–Z and underscore; digits allowed but not as the first character.";
</script>

<div class={className}>
  <input
    {id}
    class={`border-input bg-background selection:bg-primary selection:text-primary-foreground shadow-xs h-9 w-full rounded-md border px-3 py-1 text-base outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm ${inputClass}`}
    type="text"
    autocapitalize="off"
    autocomplete="off"
    spellcheck="false"
    value={raw}
    oninput={onInput}
    {placeholder}
    {pattern}
    {title}
  />
</div>
