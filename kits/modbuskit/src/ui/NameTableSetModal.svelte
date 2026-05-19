<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog";
  import * as Select from "$lib/components/ui/select";
  import { Button } from "$lib/components/ui/button";
  import { Separator } from "$lib/components/ui/separator";
  import TagInput from "@/generics/custom-input/TagInput.svelte";
  import NTSEditor from "@/ui/NTSEditor.svelte";
  import type { NameTableSet, TAG } from "@/sys/system";

  // Minimal API:
  // - open (bindable)
  // - ntsIds: list of all available set ids
  // - activeNtsId (bindable): which set is currently targeted (optional)
  // - readNTS(id): returns the current NameTableSet (from your library)
  // - onSave(id, nts), onDelete(id), onCreate(id)
  let {
    open = $bindable<boolean>(false),
    ntsIds,
    activeNtsId = $bindable<TAG | null>(null),
    readNTS,
    onSave,
    onDelete,
    onCreate,
  }: {
    open: boolean;
    ntsIds: TAG[];
    activeNtsId?: TAG | null;
    readNTS: (id: TAG) => NameTableSet;
    onSave: (id: TAG, nts: NameTableSet) => void;
    onDelete: (id: TAG) => void;
    onCreate: (id: TAG) => void;
  } = $props();

  // local selected id inside the modal (defaults to active or first)
  let selectedId = $state<TAG>(activeNtsId ?? ntsIds[0] ?? "");

  // creation dialog
  let newOpen = $state(false);
  let newId = $state<string | null>(null);
  const newIdValid = $derived(() => {
    const v = (newId ?? "").trim();
    if (v === "") return { ok: false, msg: "Identifier cannot be empty" };
    if (ntsIds.includes(v as TAG))
      return { ok: false, msg: "Identifier already exists" };
    return { ok: true, msg: "" };
  });

  function createNow() {
    if (!newIdValid().ok || !newId) return;
    const id = newId as TAG;
    onCreate(id);
    // select the new one
    if (!ntsIds.includes(id)) ntsIds = [...ntsIds, id]; // in case parent updates async
    selectedId = id;
    activeNtsId = id;
    newOpen = false;
    newId = null;
  }
  import { useAlert } from "@/ui/alert/context";
  const alert = useAlert();

  let currentDirty = $state(false); // bound from NTSEditor via a separate prop

  function handleSelect(nextId: string) {
    if (currentDirty) {
      alert.info(`Discarded unsaved changes to ${selectedId ?? "current set"}`);
    }
    selectedId = nextId;
  }
</script>
<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-[1000px]">
    <Dialog.Header>
      <Dialog.Title>Edit name table sets</Dialog.Title>
      <Dialog.Description class="text-sm text-muted-foreground">
        Choose a set to edit. Changes are applied when you press <em>Save</em>.
      </Dialog.Description>

      <!-- Header toolbar -->
      <div class="mt-3 flex items-center gap-3">
        <div class="min-w-[260px]">
          <Select.Root
            disabled={ntsIds.length === 0}
            type="single"
            value={selectedId ?? ""}
            onValueChange={handleSelect}
          >
            <Select.Trigger class="w-full h-9">
              {#if selectedId}{selectedId}{:else}<span
                  class="text-muted-foreground">Select a set…</span
                >{/if}
            </Select.Trigger>
            <Select.Content>
              {#each ntsIds as id (id)}
                <Select.Item value={id}>{id}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        </div>

        <Separator orientation="vertical" class="h-9" />

        <Button
          variant="secondary"
          onclick={() => {
            newOpen = true;
          }}
        >
          New set…
        </Button>
      </div>
    </Dialog.Header>

    <!-- Body -->
    {#if selectedId}
      <div class="mt-4">
        {#key selectedId}
          <NTSEditor
            bind:dirty={currentDirty}
            initialData={structuredClone(readNTS(selectedId).names)}
            onsave={(nts) => {
              alert.success("Name table set saved!", "Saved " + selectedId);
              onSave(selectedId as TAG, {
                updatedAt: Date.now(),
                names: nts,
              });
            }}
            ondelete={() => {
              const id = selectedId as TAG;
              onDelete(id);
              const remaining = ntsIds.filter((x) => x !== id);
              selectedId = remaining[0] ?? ""; // pick next or clear
            }}
          />
        {/key}
      </div>
    {:else}
      <p class="text-sm text-muted-foreground mt-6">
        No name table set selected. Please select an existing or create a new
        one.
      </p>
    {/if}
  </Dialog.Content>
</Dialog.Root>

<!-- "New set" dialog -->
<Dialog.Root bind:open={newOpen}>
  <Dialog.Content class="sm:max-w-[520px]">
    <Dialog.Header>
      <Dialog.Title>New name table set</Dialog.Title>
      <Dialog.Description class="text-sm text-muted-foreground">
        Choose an identifier. Use A–Z, digits, and “_”. Digits cannot be first.
      </Dialog.Description>
    </Dialog.Header>

    <div class="p-4">
      <TagInput
        placeholder="NTS_IDENTIFIER"
        bind:value={newId}
        class="w-full"
      />
      <p
        class={`mt-2 text-sm ${newIdValid().ok ? "text-muted-foreground" : "text-destructive"}`}
      >
        {newIdValid().ok ? "\u00A0" : newIdValid().msg}
      </p>
    </div>

    <Dialog.Footer>
      <Button
        variant="ghost"
        onclick={() => {
          newOpen = false;
        }}>Cancel</Button
      >
      <Button disabled={!newIdValid().ok} onclick={createNow}>Create</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
