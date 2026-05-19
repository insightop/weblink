<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog'
  import { Button } from '$lib/components/ui/button'
  import { Label } from '$lib/components/ui/label'
  import { Input } from '$lib/components/ui/input'
  import { Textarea } from '$lib/components/ui/textarea'
  import { Separator } from '$lib/components/ui/separator'
  import * as RadioGroup from '$lib/components/ui/radio-group'

  import {
    type Library,
    libraryTemplate,
    type SerializableLibrary,
    SerializableLibrarySchema,
    toSerializable,
  } from '@/sys/system'
  import type { SvelteComponent } from 'svelte'

  let {
    open = $bindable<boolean>(false),
    current,
    onExport,
    onImport,
  }: {
    open: boolean
    current: Library
    onImport: (libSer: SerializableLibrary) => void
    onExport: () => void
  } = $props()

  const currentSer = $derived.by<SerializableLibrary>(() => toSerializable(current))

  // local state (serializable-only)
  let fileInput: SvelteComponent | null = null
  let newRaw = $state('')
  let loaded: SerializableLibrary | null = $state(null)
  let loadError: string | null = $state(null)
  let mode = $state<'replace' | 'merge'>('replace')

  // merge planning
  let conflicts = $state<{ profiles: string[]; sets: string[] }>({ profiles: [], sets: [] })
  let additions = $state<{ profiles: string[]; sets: string[] }>({ profiles: [], sets: [] })
  let choices = $state<{
    profiles: Record<string, 'current' | 'new'>
    sets: Record<string, 'current' | 'new'>
  }>({ profiles: {}, sets: {} })

  // utility
  const statsCur = (l: Library) => ({
    profiles: Object.keys(l.profiles ?? {}).length,
    sets: Object.keys(l.nameTables ?? {}).length,
  })
  const statsSer = (l: SerializableLibrary | null) => ({
    profiles: l ? Object.keys(l.profiles ?? {}).length : 0,
    sets: l ? Object.keys(l.nameTables ?? {}).length : 0,
  })

  // Mutators
  function ResetLoaded() {
    newRaw = ''
    loaded = null
    loadError = null
    mode = 'replace'
    conflicts = { profiles: [], sets: [] }
    additions = { profiles: [], sets: [] }
    choices = { profiles: {}, sets: {} }
  }

  function ParseAndLoad(text: string) {
    loadError = null
    loaded = null
    try {
      const parsed = JSON.parse(text)
      // validate serializable shape
      const safe = SerializableLibrarySchema.parse(parsed) as SerializableLibrary
      // keep Serializable internally
      loaded = structuredClone(safe)
      mode = 'replace'
      ComputeDiffs()
    } catch (e: any) {
      loadError = e?.message ?? String(e)
    }
  }
  function LoadTemplate() {
    newRaw = JSON.stringify(libraryTemplate, null, 2)
    ParseAndLoad(newRaw)
  }
  function ComputeDiffs() {
    if (!loaded) {
      conflicts = { profiles: [], sets: [] }
      additions = { profiles: [], sets: [] }
      choices = { profiles: {}, sets: {} }
      return
    }
    const curP = new Set(Object.keys(currentSer.profiles ?? {}))
    const curS = new Set(Object.keys(currentSer.nameTables ?? {}))
    const newP = Object.keys(loaded.profiles ?? {})
    const newS = Object.keys(loaded.nameTables ?? {})

    const profConf = newP.filter((k) => curP.has(k))
    const setConf = newS.filter((k) => curS.has(k))
    const profAdd = newP.filter((k) => !curP.has(k))
    const setAdd = newS.filter((k) => !curS.has(k))

    conflicts = { profiles: profConf, sets: setConf }
    additions = { profiles: profAdd, sets: setAdd }

    // default conflict resolution prefer "new"
    choices = {
      profiles: Object.fromEntries(profConf.map((k) => [k, 'new' as const])),
      sets: Object.fromEntries(setConf.map((k) => [k, 'new' as const])),
    }
  }

  async function PickFile() {
    try {
      // @ts-expect-error: not universally typed
      if (window.showOpenFilePicker) {
        // @ts-expect-error: not universally typed
        const [handle] = await window.showOpenFilePicker({
          types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
          multiple: false,
        })
        const file = await handle.getFile()
        const text = await file.text()
        newRaw = text
        ParseAndLoad(text)
        return
      }
    } catch (e) {
      if ((e as any)?.name !== 'AbortError') console.error(e)
    }
    fileInput?.click()
  }

  function onFileChange(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0]
    if (!f) return
    f.text().then((txt) => {
      newRaw = txt
      ParseAndLoad(txt)
      if (fileInput) fileInput.value = ''
    })
  }

  function ChooseAll(which: 'current' | 'new', scope: 'profiles' | 'sets') {
    const map = scope === 'profiles' ? choices.profiles : choices.sets
    for (const k of conflicts[scope]) map[k] = which
  }

  function Apply() {
    if (!loaded) return

    if (mode === 'replace') {
      onImport(loaded)
      open = false
      return
    }

    // Merge (Serializable) - No need to clone since we are already taking a snapshot
    const merged: SerializableLibrary = $state.snapshot(currentSer) as SerializableLibrary;

    // Additions
    for (const k of additions.profiles) merged.profiles[k] = loaded.profiles[k]
    for (const k of additions.sets) merged.nameTables[k] = loaded.nameTables[k]

    // Conflicts
    for (const k of conflicts.profiles) {
      merged.profiles[k] = choices.profiles[k] === 'new' ? loaded.profiles[k] : currentSer.profiles[k]
    }
    for (const k of conflicts.sets) {
      merged.nameTables[k] = choices.sets[k] === 'new' ? loaded.nameTables[k] : currentSer.nameTables[k]
    }

    // Keep current activeProfileTag
    merged.activeProfileTag = currentSer.activeProfileTag ?? null

    onImport(merged)
    open = false
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-2xl">
    <Dialog.Header>
      <Dialog.Title class="text-base">Manage Storage</Dialog.Title>
      <Dialog.Description class="text-sm text-muted-foreground">
        Import a library and choose to replace or merge it with your current data. <br /> <br />
        
        <!-- Localstorage transfer method from old domain to new one -->
        <b>NOTE: </b> If you had a library saved on the old domain (changed 26.9.2025) you can copy it over from here: 
        <Button id="manage-storage-import-legacy" variant="link" class="h-8 px-3 text-xs" onclick={() => (window as any).MB_APP.importFromLegacy()}>Import localStorage from old domain</Button>
        <br /> You can copy it manually or click <i>Send to new site</i> for automatic transfer.
        <!-- End of legacy note -->

      </Dialog.Description>
    </Dialog.Header>

    <!-- Import row -->
    <div class="flex flex-wrap items-end gap-2">
      <div class="flex items-center gap-2">
        <Button id="manage-storage-pick-json" variant="secondary" class="h-8 px-3 text-xs" onclick={PickFile}>Pick JSON</Button>
        <Input
          id="manage-storage-file-input"
          bind:this={fileInput}
          class="hidden"
          type="file"
          accept="application/json,.json"
          onchange={onFileChange}
        />
        <Button id="manage-storage-export" variant="outline" class="h-8 px-3 text-xs" onclick={onExport}>Export current</Button>
        <Button id="manage-storage-clear" variant="ghost" class="h-8 px-3 text-xs" onclick={ResetLoaded}>Clear</Button>
      </div>
      <div class="ml-auto text-xs text-muted-foreground">
        Current: {statsCur(current).profiles} profiles • {statsCur(current).sets} name-table sets
      </div>
    </div>

    <div class="mt-2">
      <Label for="manage-storage-json-field" class="text-xs mb-1 block">Paste JSON</Label>
      <Textarea
        id="manage-storage-json-field"
        class="h-28 resize-y font-mono text-xs"
        placeholder="…or paste exported library JSON here"
        bind:value={newRaw}
        onchange={(e: Event) => ParseAndLoad((e.target as HTMLTextAreaElement).value)}
      />
      {#if loadError}
        <div class="mt-2 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          {loadError}
        </div>
      {/if}
    <button id="manage-storage-load-template" onclick={LoadTemplate} class="discrete text-xs m-1 ml-auto text-blue-500 float-right">Load library template</button>

    </div>
    <Separator class="my-4" />

    <!-- Mode (shadcn RadioGroup) -->
    <div class="space-y-3">
      <RadioGroup.Root class="flex flex-wrap gap-6 text-sm" bind:value={mode}>
        <div class="flex items-center gap-2">
          <RadioGroup.Item id="manage-storage-mode-replace" value="replace" />
          <Label for="manage-storage-mode-replace">Replace current library</Label>
        </div>
        <div class="flex items-center gap-2">
          <RadioGroup.Item id="manage-storage-mode-merge" value="merge" disabled={!loaded} />
          <Label for="manage-storage-mode-merge" class={!loaded ? 'opacity-50' : ''}>Merge libraries</Label>
        </div>
      </RadioGroup.Root>

      {#if loaded}
        <div class="text-xs text-muted-foreground">
          Loaded: {statsSer(loaded).profiles} profiles • {statsSer(loaded).sets} name-table sets
        </div>
      {/if}
    </div>

    {#if mode === 'merge' && loaded}
      <div class="mt-3 grid gap-3 md:grid-cols-2">
        <!-- Profiles -->
        <div class="rounded-md border">
          <div class="flex items-center justify-between p-2">
            <div class="text-sm font-medium">Profiles</div>
            {#if conflicts.profiles.length}
              <div class="flex items-center gap-2">
                <Button id="manage-storage-keep-current" variant="outline" class="h-7 px-2 text-xs" onclick={() => ChooseAll('current','profiles')}>Keep current</Button>
                <Button id="manage-storage-use-new" variant="outline" class="h-7 px-2 text-xs" onclick={() => ChooseAll('new','profiles')}>Use new</Button>
              </div>
            {/if}
          </div>
          <Separator />
          <div class="p-2 text-xs">
            <div class="mb-2 opacity-70">Add: {additions.profiles.length} • Conflicts: {conflicts.profiles.length}</div>
            <div class="h-40 overflow-y-auto pr-2">
              {#if conflicts.profiles.length === 0}
                <div class="opacity-60">No profile name conflicts.</div>
              {:else}
                <ul class="divide-y">
                  {#each conflicts.profiles as k (k)}
                    <li class="flex items-center justify-between gap-3 py-1">
                      <div class="truncate font-mono">{k}</div>
                      <RadioGroup.Root class="flex items-center gap-3" bind:value={choices.profiles[k]}>
                        <div class="flex items-center gap-1">
                          <RadioGroup.Item id={'pc-'+k} value="current" />
                          <Label for={'pc-'+k}>current</Label>
                        </div>
                        <div class="flex items-center gap-1">
                          <RadioGroup.Item id={'pn-'+k} value="new" />
                          <Label for={'pn-'+k}>new</Label>
                        </div>
                      </RadioGroup.Root>
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
          </div>
        </div>

        <!-- Name table sets -->
        <div class="rounded-md border">
          <div class="flex items-center justify-between p-2">
            <div class="text-sm font-medium">Name table sets</div>
            {#if conflicts.sets.length}
              <div class="flex items-center gap-2">
                <Button id="manage-storage-keep-all-current" variant="outline" class="h-7 px-2 text-xs" onclick={() => ChooseAll('current','sets')}>Keep current</Button>
                <Button id="manage-storage-use-all-new" variant="outline" class="h-7 px-2 text-xs" onclick={() => ChooseAll('new','sets')}>Use new</Button>
              </div>
            {/if}
          </div>
          <Separator />
          <div class="p-2 text-xs">
            <div class="mb-2 opacity-70">Add: {additions.sets.length} • Conflicts: {conflicts.sets.length}</div>
            <div class="h-40 overflow-y-auto pr-2">
              {#if conflicts.sets.length === 0}
                <div class="opacity-60">No name-table conflicts.</div>
              {:else}
                <ul class="divide-y">
                  {#each conflicts.sets as k (k)}
                    <li class="flex items-center justify-between gap-3 py-1">
                      <div class="truncate font-mono">{k}</div>
                      <RadioGroup.Root class="flex items-center gap-3" bind:value={choices.sets[k]}>
                        <div class="flex items-center gap-1">
                          <RadioGroup.Item id={'sc-'+k} value="current" />
                          <Label for={'sc-'+k}>current</Label>
                        </div>
                        <div class="flex items-center gap-1">
                          <RadioGroup.Item id={'sn-'+k} value="new" />
                          <Label for={'sn-'+k}>new</Label>
                        </div>
                      </RadioGroup.Root>
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
          </div>
        </div>
      </div>
    {/if}

    <Dialog.Footer class="mt-4">
      <Dialog.Close>
        <Button id="manage-storage-cancel" variant="outline" class="h-8 px-3 text-xs">Cancel</Button>
      </Dialog.Close>
      <Button id="manage-storage-apply" class="h-8 px-3 text-xs" disabled={!loaded} onclick={Apply}>
        {mode === 'replace' ? 'Replace' : 'Apply merge'}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
