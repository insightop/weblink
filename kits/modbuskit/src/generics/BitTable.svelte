<script lang="ts">
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table';
  import { HEX } from '@/sys/panels';

  type BitTableProps = {
    startAddress: number;
    bits: (boolean | null)[];
    names: Map<number, string>;
    regPrefix: string; // e.g. "HR" for "HR1", "IR" for "IR1"
  };

  let { startAddress, bits, names, regPrefix }: BitTableProps = $props();
</script>

<Table>
  <TableHeader>
    <TableRow>
      <TableHead class="w-20">Reg.</TableHead>
      <TableHead class="w-28">Address</TableHead>
      <TableHead>Name</TableHead>
      <TableHead class="w-16 text-right">Bit</TableHead>
      <TableHead class="w-24">Bool</TableHead>
    </TableRow>
  </TableHeader>

  <TableBody>
    {#each bits as bit, index (startAddress + index)}
      {@const address = startAddress + index}
      {@const name = names.get(address) || 'n/a'}
      <TableRow>
        <TableCell class="font-medium">{regPrefix}{address + 1}</TableCell>
        <TableCell class="font-mono">{HEX(address, 4)}</TableCell>
        <TableCell class="truncate">{name}</TableCell>
        <TableCell class="text-right font-mono">{bit === null ? 'n/a' : bit ? 1 : 0}</TableCell>
        <TableCell>
          <span
            class={`inline-flex items-center rounded px-2 py-0.5 text-xs
              ${bit === null
                ? 'bg-muted text-muted-foreground'
                : bit
                ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200'
                : 'bg-rose-100 text-rose-900 dark:bg-rose-900/30 dark:text-rose-200'}`}
          >
            {bit === null ? 'n/a' : bit ? 'true' : 'false'}
          </span>
        </TableCell>
      </TableRow>
    {/each}
  </TableBody>
</Table>
