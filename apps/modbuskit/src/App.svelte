<script lang="ts">
  import './app.css'
  import ConnectForm from '@/ui/ConnectForm.svelte'
  import { ModbusRTU } from 'modbus-webserial'
  import type { ConnectStatus } from '@/types/comp'
  import ReadPanel from '@/panels/ReadPanel.svelte'
  import type { ReadResponse, ReadQuery, WriteQuery, WriteResponse } from '@/sys/panels'
  import { onMount, setContext } from 'svelte'
  import WritePanel from '@/panels/WritePanel.svelte'
  import TopMenu from '@/ui/TopMenu.svelte'

  // ------------------------
  // Console commands
  // ------------------------
  // safe alerts (no-throw, even if alert is undefined/broken)
  const sa = {
    success: (msg: string) => {
      try {
        ;(alert as any)?.success?.(msg)
      } catch {
        console.error('Alert failed:', msg)
      }
    },
    info: (msg: string) => {
      try {
        ;(alert as any)?.info?.(msg)
      } catch {
        console.info('Alert info failed:', msg)
      }
    },
    error: (msg: string) => {
      try {
        ;(alert as any)?.error?.(msg)
      } catch {
        console.error('Alert error failed:', msg)
      }
    },
  }

  const consoleCommands = {
    resetStorage: () => {
      lib = createEmptyLibrary()
      saveLibrary(lib)
      sa.success('Storage reset to default state.')
    },

    printLibraryToConsole: () => {
      console.log('Current library state:', $state.snapshot(lib))
      sa.info('Library state printed to console.')
    },

    exportLibrary: () => {
      // Data straight from localStorage
      const data = loadRawLibrary()
      if (!data) {
        sa.error('No data to export. Library is empty.')
        return
      }
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `modbus-webui-library-${STORAGE_VERSION}.json`
      a.click()
      // revoke on next tick to avoid aborting downloads in some browsers
      setTimeout(() => URL.revokeObjectURL(url), 0)
      sa.success('Library exported successfully.')
    },

    importLibrary: (json: string) => {
      try {
        console.log('Importing library JSON:', json)
        const parsed = JSON.parse(json)
        if (typeof parsed !== 'object' || parsed === null) {
          throw new Error('Invalid JSON format')
        }
        lib = structuredClone(parsed)
        saveLibrary(lib)
        sa.success('Library imported successfully.')
      } catch (err) {
        console.error('Import failed:', err)
        const msg = err instanceof Error ? err.message : String(err)
        sa.error(`Import failed: ${msg}`)
      }
    },

    importLibraryFromFile: async () => {
      try {
        if ('showOpenFilePicker' in window) {
          // @ts-expect-error: FS Access API types not always present
          const [handle] = await window.showOpenFilePicker({
            types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
            multiple: false,
          })
          const file = await handle.getFile()
          const text = await file.text()
          consoleCommands.importLibrary(text)
          return
        }

        // Fallback: ad-hoc <input type="file">
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'application/json,.json'
        input.style.position = 'fixed'
        input.style.left = '-9999px'
        document.body.appendChild(input)
        input.onchange = async () => {
          try {
            const file = input.files?.[0]
            if (!file) return
            const text = await file.text()
            consoleCommands.importLibrary(text)
          } finally {
            input.remove()
          }
        }
        input.click()
      } catch (err) {
        if ((err as any)?.name === 'AbortError') return // user canceled
        console.error('Import picker failed:', err)
        const msg = err instanceof Error ? err.message : String(err)
        sa.error(`Import failed: ${msg}`)
      }
    },
    importFromLegacy: async () => {
      const LEGACY_EXPORTER_URL = new URL("https://anttikotajarvi.github.io/modbus-webui-legacy-export/");
      const popup = window.open(LEGACY_EXPORTER_URL.href, '_blank', 'width=640,height=800')
      window.addEventListener(
        'message',
        (ev) => {
          if (ev.origin !== LEGACY_EXPORTER_URL.origin) return
          if (!ev.data || ev.data.type !== 'MODBUS_WEBUI_LEGACY_EXPORT') return

          const lib = ev.data.data
          if (typeof lib !== 'object' || lib === null) {
            sa.error('Legacy library import failed: invalid data received.')
            return
          }
          sa.info('Legacy library received. Proceeding to import…')
          console.log('Legacy lib:', lib)

          consoleCommands.importLibrary(JSON.stringify(lib)) // Already in json format
          popup?.close()
        },
        { once: true },
      )
    },
  }

  // expose to window early so it works even if UI fails later
  ;(globalThis as any).MB_APP ??= {}
  Object.assign((globalThis as any).MB_APP, consoleCommands)

  // ------------------------
  // Modbus client setup
  // ------------------------
  let client: ModbusRTU | null = null
  const conn: ConnectStatus = $state<ConnectStatus>({
    status: 'idle',
    msg: '',
    error: false,
  })

  const readFromClient = async (query: ReadQuery) => {
    if (!client) {
      throw new Error('Modbus client is not connected')
    }

    const methodMap = {
      read_input_registers: (c: ModbusRTU, a: number, q: number) => c.readInputRegisters(a, q),
      read_holding_registers: (c: ModbusRTU, a: number, q: number) => c.readHoldingRegisters(a, q),
      read_coils: (c: ModbusRTU, a: number, q: number) => c.readCoils(a, q),
      read_discrete_inputs: (c: ModbusRTU, a: number, q: number) => c.readDiscreteInputs(a, q),
    }

    const method = methodMap[query.type]

    const res = await method(client, query.address, query.quantity).catch((err: any) => {
      throw new Error(`Failed to read from client: ${err.message}`)
    })

    return {
      fromFunction: query.type,
      startAddress: query.address,
      data: res.data,
    } as ReadResponse
  }
  const writeToClient = async (query: WriteQuery): Promise<WriteResponse> => {
    if (!client) {
      throw new Error('Modbus client is not connected')
    }

    const quantity = query.values.length
    const methodMap = {
      write_registers: (c: ModbusRTU, a: number, v: number[]) => {
        if (quantity == 1) {
          return c.writeRegister(a, v[0])
        } else {
          return c.writeRegisters(a, v)
        }
      },
      write_coils: (c: ModbusRTU, a: number, v: boolean[]) => {
        if (quantity == 1) {
          return c.writeCoil(a, v[0])
        } else {
          return c.writeCoils(a, v)
        }
      },
    } as const

    const method = methodMap[query.type] as (
      c: ModbusRTU,
      a: number,
      v: number[] | boolean[],
    ) => Promise<unknown>

    if (!method) {
      throw new Error(`Unsupported write type: ${query.type}`)
    }

    await method(client, query.address, query.values).catch((err: any) => {
      throw new Error(`Failed to write to client: ${err.message}`)
    })

    return {
      fromFunction: query.type,
      address: query.address,
      quantity,
    } as WriteResponse
  }

  setContext('readFromClient', readFromClient)
  setContext('writeToClient', writeToClient)

  function Connect() {
    conn.status = 'connecting'
    conn.msg = 'Connecting...'
    const { deviceId, options } = lib.profiles[activeProfileId ?? SCRATCH_ID].connectionSettings

    ModbusRTU.openWebSerial(options)
      .then((_client) => {
        client = _client
        client.setID(deviceId)
        conn.status = 'connected'
        conn.msg = 'Connected successfully'
        const { usbVendorId, usbProductId } = client.getPort().getInfo()
        conn.msg += ` (USB Vendor ID: ${usbVendorId}, Product ID: ${usbProductId})`
      })
      .catch((err) => {
        conn.status = 'disconnected'
        conn.error = true
        conn.msg = `Connection failed: ${err.message}`
      })
  }

  function Disconnect() {
    if (client) {
      client
        .close()
        .then(() => {
          client = null
          conn.status = 'disconnected'
          conn.msg = ''
        })
        .catch((err) => {
          conn.error = true
          conn.msg = `Disconnection failed: ${err.message}`
        })
    }
  }
  import {
    createEmptyLibrary,
    defaultConfiguration,
    deleteProfile as _deleteProfile,
    upsertProfile,
    type Library,
    type TAG,
    SCRATCH_ID,
    upsertNameTableSet,
    createEmptyNameTableSet,
    type NameTableSet,
    deleteNameTableSet,
    type Configuration,
    loadLibrary,
    saveLibrary,
    STORAGE_VERSION,
    loadRawLibrary,
    fromSerializable,
    type SerializableLibrary,
  } from '@/sys/system'
  import CreateProfileModal from '@/ui/CreateProfileModal.svelte'
  import { debounce } from '@/sys/generic'
  import NameTableSetModal from '@/ui/NameTableSetModal.svelte'
  import SystemAlert from '@/ui/alert/SystemAlert.svelte'

  let modals = $state({ addProfileOpen: false, nameTableOpen: false, manageStorageOpen: false })

  // -------------------------
  // Profile management
  // -------------------------
  /* Library */
  let lib = $state<Library>(
    (() => {
      const lib = loadLibrary()
      if (!lib.profiles[SCRATCH_ID]) {
        lib.profiles[SCRATCH_ID] = structuredClone(defaultConfiguration)
      }
      return lib
    })(),
  )

  // dirty flag (for UI)
  let libraryDirty = $state(false)

  // ignore the first reactive pass (initial load)
  let _ignoreDirty = true
  queueMicrotask(() =>
    requestAnimationFrame(() => {
      _ignoreDirty = false
    }),
  )

  // save impl used by both manual + autosave
  function _save(snapshot: Library) {
    saveLibrary(snapshot)
    libraryDirty = false
    lastSavedAt = Date.now()
  }
  // Autosave - debounced
  const AUTOSAVE_DELAY = 1000
  let lastSavedAt = $state<number | null>(null)

  const autosaveDebounced = debounce((snap: Library) => {
    try {
      _save(snap)
    } catch (e) {
      console.error('Autosave failed:', e)
    }
  }, AUTOSAVE_DELAY)

  // mark dirty + autosave whenever lib changes (deep)
  $effect(() => {
    const snap = $state.snapshot(lib) // deep subscribe and capture snapshot
    if (_ignoreDirty) return

    libraryDirty = true
    autosaveDebounced(snap)
  })

  // manual save (e.g., from a “Save” button)
  function PersistLibrary() {
    const snap = $state.snapshot(lib)
    _save(snap)
    alert.success('Library saved to localStorage.')
  }

  onMount(() => {
    // Autosave on unload or visibility change
    const flush = () => {
      if (!libraryDirty) return
      try {
        _save($state.snapshot(lib))
      } catch (e) {
        console.error('Autosave failed:', e)
      }
    }
    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush()
    })
    return () => {
      window.removeEventListener('beforeunload', flush)
      document.removeEventListener('visibilitychange', flush as any)
    }
  })

  /* Derived references */
  // Bind to 'lib' directly; these are readonly helpers
  let activeProfileId: Readonly<TAG> = $derived(lib.activeProfileTag ?? SCRATCH_ID)
  let currentProfile: Readonly<Configuration> = $derived(
    lib.profiles[activeProfileId] ?? defaultConfiguration,
  )
  let currentNTS: Readonly<NameTableSet> = $derived.by(() =>
    currentProfile.nameTableSetId
      ? (lib.nameTables[currentProfile.nameTableSetId] ?? createEmptyNameTableSet())
      : createEmptyNameTableSet(),
  )
  // Now these work with a real object:
  function handleCreateProfile(id: TAG, template: 'default' | 'current') {
    const newConfig =
      template === 'current'
        ? structuredClone($state.snapshot(currentProfile))
        : structuredClone(defaultConfiguration)
    lib = upsertProfile(lib, id, newConfig)
    lib.activeProfileTag = id
  }

  function handleDeleteProfile(id: TAG | null) {
    if (id === SCRATCH_ID || id === null) return
    lib = _deleteProfile(lib, id)
    if (lib.activeProfileTag === id) lib.activeProfileTag = null
    alert.info(`Profile "${id}" deleted successfully.`)
  }

  // Shortcuts

  function AddShortcut(name: string, query: WriteQuery) {
    if (!name || !query) return
    // reassign to trigger binding
    lib.profiles[activeProfileId].writeShortcuts = {
      ...lib.profiles[activeProfileId].writeShortcuts,
      [name]: query,
    }
  }

  import { useAlert } from '@/ui/alert/context'
  import QuickWritePanel from '@/panels/QuickWritePanel.svelte'
  import ManageStorageModal from './ui/ManageStorageModal.svelte'
  const alert = useAlert()
</script>

<div class="flex min-h-dvh flex-col">
  <!-- or min-h-screen -->

  <SystemAlert />
  <CreateProfileModal
    bind:open={modals.addProfileOpen}
    existingIds={Object.keys(lib.profiles)}
    onCreate={handleCreateProfile}
  />

  <TopMenu
    ntsTags={Object.keys(lib.nameTables)}
    bind:activeNtsTag={lib.profiles[activeProfileId].nameTableSetId}
    onEditNts={() => (modals.nameTableOpen = true)}
    profileTags={Object.keys(lib.profiles)}
    bind:activeProfileId={lib.activeProfileTag}
    onProfileSelect={(id) => (lib.activeProfileTag = id)}
    onProfileAdd={() => (modals.addProfileOpen = true)}
    onProfileDelete={() => handleDeleteProfile(lib.activeProfileTag)}
    {libraryDirty}
    onLibrarySave={PersistLibrary}
    {lastSavedAt}
    onStorageManage={() => (modals.manageStorageOpen = true)}
  />

  <ConnectForm
    bind:settings={lib.profiles[activeProfileId].connectionSettings}
    status={conn}
    onsubmit={Connect}
    ondisconnect={Disconnect}
  />
  <!-- App shell: make page fill the viewport -->
  <!-- App.svelte layout snippet -->
  <main class="flex-1 p-4 min-w-0">
    <!-- Stack by default; only split into C1 (reads) + C2 (writes) when there's room for both -->
    <div class="grid gap-6 min-w-0 min-[1480px]:grid-cols-[minmax(0,1fr)_clamp(700px,28vw,900px)]">
      <!-- C1: READS (NO min-width here!) -->
      <section class="reads min-w-0">
        <div class="reads-grid">
          <div class="col">
            <div class="wrap grid gap-4 w-full max-w-[900px] mx-auto">
              <ReadPanel id="rp-hr" type="read_holding_registers" nts={currentNTS} />
              <ReadPanel id="rp-ir" type="read_input_registers" nts={currentNTS} />
            </div>
          </div>

          <div class="col">
            <div class="wrap grid gap-4 w-full max-w-[900px] mx-auto">
              <ReadPanel id="rp-c" type="read_coils" nts={currentNTS} />
              <ReadPanel id="rp-di" type="read_discrete_inputs" nts={currentNTS} />
            </div>
          </div>
        </div>
      </section>

      <!-- C2: WRITES (right rail only when the parent hits 1480px; stacked otherwise) -->
      <aside class="min-w-0 w-full space-y-4 self-start min-[1480px]:sticky min-[1480px]:top-4">
        <div class="mx-auto w-full max-w-[900px] grid gap-4">
          <QuickWritePanel
            bind:shortcuts={lib.profiles[activeProfileId].writeShortcuts}
            nts={currentNTS}
          />
          <WritePanel
            id="wp-hr"
            type="write_registers"
            nts={currentNTS}
            addShortcut={AddShortcut}
          />
          <WritePanel id="wp-c" type="write_coils" nts={currentNTS} addShortcut={AddShortcut} />
        </div>
      </aside>
    </div>
  </main>

  <!-- Modal to edit name tables -->
  <NameTableSetModal
    bind:open={modals.nameTableOpen}
    readNTS={(id: TAG) => $state.snapshot(lib.nameTables[id]) ?? createEmptyNameTableSet()}
    ntsIds={Object.keys(lib.nameTables)}
    bind:activeNtsId={lib.profiles[activeProfileId].nameTableSetId}
    onCreate={(id: TAG) => {
      lib = upsertNameTableSet(lib, id, createEmptyNameTableSet())
      lib.profiles[activeProfileId].nameTableSetId = id
    }}
    onSave={(id: TAG, nts: NameTableSet) => {
      lib = upsertNameTableSet(lib, id, nts)
      lib.profiles[activeProfileId].nameTableSetId = id
    }}
    onDelete={(id: TAG) => {
      lib = deleteNameTableSet(lib, id)
      lib.profiles[activeProfileId].nameTableSetId = null
    }}
  />
  <!-- Modal to manage storage (import/export) -->
  <ManageStorageModal
    bind:open={modals.manageStorageOpen}
    current={lib}
    onExport={() => consoleCommands.exportLibrary()}
    onImport={(libSer: SerializableLibrary) => {
      lib = fromSerializable($state.snapshot(libSer) as SerializableLibrary)
      saveLibrary(lib)
      alert.success('Storage imported successfully.')
    }}
  />
</div>

<style>
  /* Make the READS area respond to its own width */
  .reads {
    container-type: inline-size;
  }

  /* Base: single centered column */
  .reads-grid {
    --gap: 1rem;
    display: grid;
    gap: var(--gap);
    justify-content: center;
    grid-template-columns: 1fr;
  }

  .col {
    min-width: 0;
  }

  /* Each read column uses up to 900px and centers itself */
  .wrap {
    width: 100%;
    max-width: 900px;
    margin-inline: auto;
  }

  /* When the READS container itself can fit 2×700px + gap, go 2-up.
     1420 = 700 + 700 + ~20px gap (adjust if your gap is different). */
  @container (min-width: 1420px) {
    .reads-grid {
      grid-template-columns: repeat(2, minmax(700px, 900px));
    }
  }
</style>
