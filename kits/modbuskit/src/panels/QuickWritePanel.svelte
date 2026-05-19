<script lang="ts">
  import * as Card from '$lib/components/ui/card'
  import * as Table from '$lib/components/ui/table'
  import { Button } from '$lib/components/ui/button'
  import { Play, Trash2 } from 'lucide-svelte'
  import { getContext } from 'svelte'

  import { HEX, regPrefixes, type WriteQuery, type WriteResponse } from '@/sys/panels'
  import { useAlert } from '@/ui/alert/context'
    import { resolveAddressName, type NameTableSet } from '@/sys/system'

  // Simple interface: a bindable map from name -> WriteQuery
  let { shortcuts = $bindable<Record<string, WriteQuery>>({}) , nts}: {
    shortcuts: Record<string, WriteQuery>
    nts: NameTableSet
  } = $props()

  // Execute write using app-provided context
  const writeToClient = getContext<(q: WriteQuery) => Promise<WriteResponse>>('writeToClient')
  const alert = useAlert()

  // Derived list for rendering
  let rows = $derived(Object.entries(shortcuts))

  function fnLabel(q: WriteQuery) {
    if (q.type === 'write_registers') {
      return q.values.length === 1 ? 'write_single_register' : 'write_multiple_registers'
    }
    return q.values.length === 1 ? 'write_single_coil' : 'write_multiple_coils'
  }

  function callDisplayParts(q: WriteQuery, maxVals = 6) {
    const addr = HEX(q.address)
    const vals = (q.values ?? []) as Array<number | boolean>
    const parts = vals
      .slice(0, maxVals)
      .map((v) => (q.type === 'write_coils' ? (v ? '0x01' : '0x00') : HEX(v as number)))
    //const more = vals.length > maxVals ? ` …(+${vals.length - maxVals})` : ''
    return { label: fnLabel(q), address: addr, parts: parts.join(' ') }
  }

  async function run(name: string) {
    const q = shortcuts[name] as WriteQuery
    if (!q) return
    try {
      const res = await writeToClient(q)
      const prefix = regPrefixes[q.type]
      alert.success(
        `'${name}' write successful`,
        `${fnLabel(q)} @ ${HEX(res.address)} (${prefix}${res.address + 1}) → ${res.quantity} value(s)`,
      )
    } catch (e: any) {
      alert.error('Write failed', e?.message ?? 'Unknown error')
    }
  }

  function del(name: string) {
    // reassign to trigger binding
    const { [name]: _omit, ...rest } = shortcuts
    shortcuts = rest
  }
</script>

<Card.Root class="w-full">
  <Card.Header class="flex items-center justify-between gap-3">
    <h3 class="truncate font-semibold">Write Shortcuts</h3>
    <span class="text-sm text-muted-foreground">{rows.length} saved</span>
  </Card.Header>

  <Card.Content class="p-0">
    {#if rows.length === 0}
      <div class="px-4 py-8 text-sm text-muted-foreground">
        No shortcuts yet. Save one from the Write panel.
      </div>
    {:else}
      <Table.Root class="w-full">
        <Table.Header>
          <Table.Row>
            <Table.Head class="w-[28%]">Name</Table.Head>
            <Table.Head>Call</Table.Head>
            <Table.Head class="w-[140px] text-right">Actions</Table.Head>
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {#each rows as [name, q] (name)}

          {@const { label, address, parts } = callDisplayParts(q)}
          {@const resolvedName = resolveAddressName(q, nts) }
            <Table.Row
              class="hover:bg-secondary/40 cursor-pointer"
              onclick={() => run(name)}
              role="button"
              aria-label={`Run ${name}`}
            >
              <Table.Cell class="">
                <div class="font-medium">{name}</div>
              </Table.Cell>
              <Table.Cell class="align-top">
                <div class="font-mono text-xs">{label} {address}{resolvedName ? `/${resolvedName}` : ""}</div>
                <div class="text-xs text-muted-foreground">{parts}</div>
              </Table.Cell>
              <Table.Cell class="align-top">
                <div class="flex justify-end gap-2">
                  <Button size="sm" onclick={(e) => {
                    e.stopPropagation()
                    run(name)
                  }} aria-label={`Run ${name}`}>
                    <Play class="size-4 mr-1" /> Run
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onclick={() => del(name)}
                    aria-label={`Delete ${name}`}
                  >
                    <Trash2 class="size-4" />
                  </Button>
                </div>
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    {/if}
  </Card.Content>
  <Card.Footer class="text-xs text-muted-foreground">
    Click a row (or <em>Run</em>) to execute immediately. Shorthands are stored in your current profile.
  </Card.Footer>
</Card.Root>
