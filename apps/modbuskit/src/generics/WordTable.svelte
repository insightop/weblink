<script lang="ts">
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '$lib/components/ui/table';
  import { BINg, HEX } from '@/sys/panels';

  type WordTableProps = {
    startAddress: number;
    words: (number | null)[];
    names: Map<number, string>;
    regPrefix: string; // e.g. "HR" for "HR1", "IR" for "IR1"
    class?: string; // optional class for styling
  };

  let { startAddress, words, names, regPrefix, class: tableClass }: WordTableProps = $props();
</script>

<Table class="w-full {tableClass}">
  <TableHeader>
    <TableRow>
      <TableHead class="w-20">Reg.</TableHead>
      <TableHead class="w-28">Address</TableHead>
      <TableHead>Name</TableHead>
      <TableHead class="w-24 text-right">Decimal</TableHead>
      <TableHead class="w-24">Hex</TableHead>
      <TableHead class="w-[260px]">Binary</TableHead>
    </TableRow>
  </TableHeader>

  <TableBody>
    {#each words as word, index (startAddress + index)}
      {@const address = startAddress + index}
      {@const name = names.get(address)}
      <TableRow>
        <TableCell class="font-medium">{regPrefix}{address + 1}</TableCell>
        <TableCell class="font-mono">{HEX(address, 4)}</TableCell>
        <TableCell class="truncate {name ? '' : 'text-gray-200'}">{name ?? 'n/a'}</TableCell>
        <TableCell class="text-right font-mono">{word ?? 'n/a'}</TableCell>
        <TableCell class="font-mono">{word == null ? 'n/a' : HEX(word, 4)}</TableCell>
        <TableCell class="font-mono">{word == null ? 'n/a' : BINg(word, 16, 4)}</TableCell>
      </TableRow>
    {/each}
  </TableBody>
</Table>
