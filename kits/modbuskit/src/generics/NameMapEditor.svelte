<script lang="ts">
  import * as Table from "$lib/components/ui/table";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import HexInput from "@/generics/custom-input/HexInput.svelte";
  import { HEX } from "@/sys/panels";

  let {
    value = $bindable<Map<number, string>>(new Map()),
    label = "",
  }: {
    value: Map<number, string>;
    label?: string;
  } = $props();

  // trigger re-render on in-place Map mutations
  let ver = $state(0);
  const bump = () => (ver = (ver + 1) | 0);

  // replace Map reference to notify parent
  function poke() {
    // TODO: use SvelteMap
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    value = new Map(value);
  }

  // sorted snapshot for display
  const rows = $derived.by(() => {
    void ver; // depend on version tick
    const arr: { key: number; name: string }[] = [];
    for (const [k, v] of value.entries()) arr.push({ key: k, name: v });
    arr.sort((a, b) => a.key - b.key);
    return arr;
  });

  /* Input row */
  let inAddr = $state<number>(0);
  let inName = $state<string>("");
  let inError = $state<string | null>(null);

  let addrKey = $state(0);

  function suggestNext(n: number) {
    return Math.min(0xffff, Math.max(0, n + 1));
  }

  function addEntry() {
    const addr = inAddr ?? 0;
    const name = inName.trim();

    if (addr < 0 || addr > 0xffff) { inError = "Address must be 0x0000–0xFFFF"; return }
    if (!name) { inError = "Name cannot be empty"; return }
    // allow overwriting existing names at same address

    value.set(addr, name); // mutate in place
    bump();
    poke();

    inError = null;
    inName = "";
    inAddr = suggestNext(addr);

    addrKey++; // force HexInput to refresh for rapid entry
  }

  function removeEntry(k: number) {
    value.delete(k);
    bump();
    poke();
  }

  function onInputRowSubmit(e: Event) {
    e.preventDefault();
    addEntry();
  }
</script>

<div class="space-y-3">
  {#if label}
    <div class="flex items-center justify-between">
      <span class="text-sm text-muted-foreground">{label}</span>
      <div class="text-xs text-muted-foreground">{rows.length} entries</div>
    </div>
  {/if}

  <Table.Root class="w-full">
    <Table.Header>
      <Table.Row>
        <Table.Head class="w-40">Address</Table.Head>
        <Table.Head>Name</Table.Head>
        <Table.Head class="w-24 text-right">Actions</Table.Head>
      </Table.Row>
    </Table.Header>

    <Table.Body>
      {#if rows.length === 0}
        <Table.Row>
          <Table.Cell colspan={3} class="text-sm text-muted-foreground">
            No entries. Add your first one below.
          </Table.Cell>
        </Table.Row>
      {:else}
        {#each rows as r (r.key)}
          <Table.Row>
            <Table.Cell class="font-mono">{HEX(r.key, 4)}</Table.Cell>
            <Table.Cell class="truncate">{r.name}</Table.Cell>
            <Table.Cell class="text-right">
              <Button variant="ghost" onclick={() => removeEntry(r.key)}>Remove</Button>
            </Table.Cell>
          </Table.Row>
        {/each}
      {/if}

      <!-- INPUT ROW (always last) -->
      <Table.Row>
        <Table.Cell>
          {#key addrKey}
            <HexInput
              bind:value={inAddr}
              min={0}
              max={0xffff}
              display="hex"
              uppercaseHex={true}
              class="h-9 w-36"
              placeholder="0x0000"
            />
          {/key}
        </Table.Cell>
        <Table.Cell>
          <form onsubmit={onInputRowSubmit}>
            <Input
              class="h-9 w-full"
              bind:value={inName}
              placeholder="Name"
            />
            <button aria-hidden="true" type="submit" hidden></button>
          </form>
        </Table.Cell>
        <Table.Cell class="text-right">
          <Button variant="secondary" onclick={addEntry}>Add</Button>
        </Table.Cell>
      </Table.Row>
    </Table.Body>
  </Table.Root>

  {#if inError}
    <p class="text-sm text-destructive">{inError}</p>
  {/if}
</div>
