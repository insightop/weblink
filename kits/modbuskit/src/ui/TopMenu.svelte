<script lang="ts">
  import * as Menubar from '$lib/components/ui/menubar'
  import { Separator } from '$lib/components/ui/separator'
  import { SCRATCH_ID, type TAG } from '@/sys/system'

  let {
    // Name tables
    ntsTags,
    activeNtsTag = $bindable<TAG | null>(null),
    onEditNts,

    // Profiles (configurations)
    profileTags,
    activeProfileId = $bindable<TAG | null>(null),
    onProfileSelect,
    onProfileAdd,
    onProfileDelete,

    // Library
    libraryDirty,
    onLibrarySave,
    lastSavedAt,

    // Storage
    onStorageManage // TODO: should use context or stores for modals
  }: {
    ntsTags: TAG[]
    activeNtsTag: TAG | null
    onEditNts: () => void
    profileTags: TAG[]
    activeProfileId: TAG | null
    onProfileSelect: (id: TAG) => void
    onProfileAdd: () => void
    onProfileDelete: () => void
    libraryDirty: boolean
    onLibrarySave: () => void
    lastSavedAt: number | null
    onStorageManage: () => void
  } = $props()

  // Local UI

  function selectProfile(id: TAG) {
    activeProfileId = id
    onProfileSelect(id)
  }

  function applyNts(id: TAG | null) {
    activeNtsTag = id
    onEditNts()
  }
  // Format long name to "REALLY_LONG_NAME..."
  const TAG_MAX_LENGTH = 15
  let formattedProfileId = $derived.by(() => {
    if (!activeProfileId) return 'Unnamed profile'
    return activeProfileId.length > TAG_MAX_LENGTH
      ? `${activeProfileId.slice(0, TAG_MAX_LENGTH)}...`
      : activeProfileId
  })

  let formattedNtsTag = $derived.by(() => {
    if (!activeNtsTag) return 'Not selected'
    return activeNtsTag.length > TAG_MAX_LENGTH
      ? `${activeNtsTag.slice(0, TAG_MAX_LENGTH)}...`
      : activeNtsTag
  })
</script>

<!-- Top menubar strip -->
<nav class="w-full p-4 pt-2 h-9 bg-white p-0">
  <Menubar.Root class="flex-1 width-min p-0 h-9">
    <!-- Profiles menu -->
    <Menubar.Menu>
      <Menubar.Trigger>Profiles</Menubar.Trigger>
      <Menubar.Content>
        {#if profileTags.length === 1 && profileTags[0] === SCRATCH_ID}
          <Menubar.Item disabled>No profiles</Menubar.Item>
        {:else}
          {#each profileTags as p (p)}
            {#if p !== SCRATCH_ID}
              <Menubar.Item onclick={() => selectProfile(p)}>
                <span class="inline-flex items-center gap-2">
                  {#if activeProfileId === p}
                    <span class="size-1.5 rounded-full bg-primary"></span>
                  {:else}
                    <span class="size-1.5 rounded-full bg-muted-foreground/30"></span>
                  {/if}
                  {p}
                </span>
              </Menubar.Item>
            {/if}
          {/each}
        {/if}
        <Menubar.Separator />
        <Menubar.Item onclick={onProfileAdd}>Add Profile…</Menubar.Item>
      </Menubar.Content>
    </Menubar.Menu>

    <!-- Name tables menu -->
    <Menubar.Menu>
      <Menubar.Trigger>Name Tables</Menubar.Trigger>
      <Menubar.Content>
        {#if ntsTags.length === 0}
          <Menubar.Item disabled>No name tables</Menubar.Item>
        {:else}
          {#each ntsTags as s (s)}
            <Menubar.Item onclick={() => applyNts(s)}>
              <span class="inline-flex items-center gap-2">
                {#if activeNtsTag === s}
                  <span class="size-1.5 rounded-full bg-primary"></span>
                {:else}
                  <span class="size-1.5 rounded-full bg-muted-foreground/30"></span>
                {/if}
                {s}
              </span>
            </Menubar.Item>
          {/each}
        {/if}
        <Menubar.Separator />
        <Menubar.Item onclick={onEditNts}>Edit…</Menubar.Item>
      </Menubar.Content>
    </Menubar.Menu>
    <!-- Profiles description -->
    <Separator orientation="vertical" />

    <Menubar.Menu>
      <Menubar.Separator />
      <div class="h-9 w-[160px] pb-[2px] flex items-center px-2 text-muted-foreground">
        <!-- fixed width so it sits at the right edge, content left-aligned -->
        <div class="w-[12rem] leading-tight text-left">
          <div class="h-3 flex items-center justify-between">
            <span class="w-[90px] h-3 text-xs w-[8ch]">Current profile</span>

            <button onclick={onProfileDelete} class="h-3 p-0 discrete text-xs text-red-500"
              >Delete</button
            >
          </div>
          <div class="h-3 text-xs mt-[2px]">
            <strong>{formattedProfileId}</strong>
          </div>
        </div>
      </div>
    </Menubar.Menu>
    <Separator orientation="vertical" />
    <!-- Name tables description -->
    <Menubar.Menu>
      <Menubar.Separator />
      <div class="h-9 w-[160px] pb-[2px] flex items-center px-2 text-muted-foreground">
        <!-- fixed width so it sits at the right edge, content left-aligned -->
        <div class="w-[12rem] leading-tight text-left">
          <div class="h-3 flex items-center justify-between">
            <span class="h-3 text-xs">Selected nametable</span>
          </div>
          <div class="h-3 text-xs mt-[2px]">
            <strong>{formattedNtsTag}</strong>
          </div>
        </div>
      </div>
    </Menubar.Menu>
    <!-- Library status -->
    <Menubar.Menu>
      <Menubar.Separator />
      <div class="h-9 w-[250px] pb-[2px] flex items-center px-2 ml-auto text-muted-foreground">
        <Separator orientation="vertical" class="mr-4 !h-[60%]" />

        <!-- fixed width so it sits at the right edge, content left-aligned -->
        <div class="w-full leading-tight text-left">
          <!-- top line: left-aligned -->
          <div class="h-3 text-xs">
            Local storage {libraryDirty ? '(unsaved)' : '(saved)'}
            <span class="w-[90px] h-3 text-xs w-[8ch] text-right float-right">
              <i>{lastSavedAt ? new Date(lastSavedAt).toLocaleTimeString() : ''}</i>
            </span>
          </div>

          <!-- bottom line: Save left, time right (no jumping) -->
          <div class="h-3 mt-[2px] flex items-center justify-between">
            <button onclick={onLibrarySave} class="h-3 p-0 discrete text-xs text-emerald-500">
              Save
            </button>
            <span class="w-[100px] h-3 text-xs w-[8ch] text-right">
              <button onclick={onStorageManage} class="h-3 p-0 discrete text-xs text-emerald-500">
                Import/Export
              </button>
            </span>
          </div>
        </div>
      </div>
    </Menubar.Menu>
  </Menubar.Root>
</nav>

<style>
</style>
