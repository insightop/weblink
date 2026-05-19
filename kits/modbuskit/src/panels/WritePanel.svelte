<script lang="ts">
  import * as Collapsible from "$lib/components/ui/collapsible";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Label } from "$lib/components/ui/label";
  import { Separator } from "$lib/components/ui/separator";
  import { ChevronUp } from "lucide-svelte";
  import * as Table from "$lib/components/ui/table";

  import {
    BINg,
    HEX,
    regPrefixes,
    type WriteFunction,
    type WriteQuery,
    type WriteResponse,
  } from "@/sys/panels";
  import HexInput from "@/generics/custom-input/HexInput.svelte";

  let {
    id,
    type,
    nts,
    addShortcut,
  }: {
    id: string;
    type: WriteFunction;
    nts: NameTableSet;
    addShortcut: (name: string, query: WriteQuery) => void;
  } = $props();
  let address = $state<number>(0);
  let wordValues = $state<number[]>([]);
  let bitValues = $state<boolean[]>([]);
  const rightValues = $derived(type === "write_coils" ? bitValues : wordValues);
  const writeToClient =
    getContext<(query: WriteQuery) => Promise<WriteResponse>>("writeToClient");
  let status = $state({ msg: "", error: false });
  function writeData() {
    if (!isQueryValid()) {
      alert.error("Invalid query parameters.");
      return;
    }
    writeToClient({
      type,
      address,
      values: type === "write_coils" ? bitValues : wordValues,
    })
      .then((res: WriteResponse) => {
        console.log("Write successful:", res);
        status.msg = `Succesfully wrote ${res.quantity} values to address ${HEX(res.address, 4)} (${regPrefixes[type]}${res.address + 1})`;
        status.error = false;
      })
      .catch((err: any) => {
        console.error("Write failed:", err);
        status.msg = `Write failed: ${err.message}`;
        status.error = true;
      });
  }

  let open = $state(true);
  import HexArrayInput from "@/generics/custom-input/HexArrayInput.svelte";
  import { getContext } from "svelte";
  import BinaryArrayInput from "@/generics/custom-input/BinaryArrayInput.svelte";
  import {
    nameTableCategoryFromFunctionType,
    type NameTableSet,
  } from "@/sys/system";
  import { useAlert } from "@/ui/alert/context";
  import TagInput from "@/generics/custom-input/TagInput.svelte";
  const regPrefix = (n: number) => regPrefixes[type] + `${n + 1}`;
  let functionDisplayName = $derived(() => {
    switch (type) {
      case "write_coils":
        return bitValues.length == 1
          ? "write_single_coil"
          : "write_multiple_coils";
      case "write_registers":
        return wordValues.length == 1
          ? "write_single_register"
          : "write_multiple_registers";
      default:
        return null;
    }
  });

  let showToastMessage = $state(false);
  let toast = () => {
    showToastMessage = true;
    setTimeout(() => {
      showToastMessage = false;
    }, 3000); // Hide after 3 seconds
  };
  function isQueryValid() {
    if (type === "write_coils") {
      return bitValues.length > 0 && address >= 0 && address <= 0xffff;
    } else if (type === "write_registers") {
      return wordValues.length > 0 && address >= 0 && address <= 0xffff;
    }
    return false;
  }
  let nameBucket = $derived(nts.names[nameTableCategoryFromFunctionType[type]]);
  let addressResolved = $derived(nameBucket.get(address));

  const alert = useAlert();
  // Shortcuts
  let shortcutName = $state<string>("");
  function saveShortcut() {
    if (shortcutName.trim() === "") {
      alert.error("Shortcut name cannot be empty.");
      return;
    }
    if (!isQueryValid()) {
      alert.error("Invalid query parameters.");
      return;
    }
    addShortcut(shortcutName, {
      type,
      address,
      values: rightValues,
    });
    toast();
    shortcutName = ""; // Reset after saving
  }
</script>

{#snippet registerTableRow(address: number, v: number, i: number)}
  {@const thisAddress = address + i}
  {@const name = nameBucket.get(thisAddress) || "n/a"}
  <Table.Row>
    <Table.Cell class="font-medium">{regPrefix(thisAddress)}</Table.Cell>
    <Table.Cell class="font-mono">{HEX(thisAddress, 4)}</Table.Cell>
    <Table.Cell class="truncate">
      {name}
    </Table.Cell>
    <Table.Cell class="text-blue-500 text-right font-mono">{v}</Table.Cell>
    <Table.Cell class="text-blue-500 font-mono"
      >{HEX(v as number, 4)}</Table.Cell
    >
    <Table.Cell class="text-blue-500 font-mono"
      >{BINg(v as number, 16, 4)}</Table.Cell
    >
  </Table.Row>
{/snippet}
{#snippet coilTableRow(address: number, v: boolean, i: number)}
  {@const thisAddress = address + i}
  {@const name = nameBucket.get(thisAddress) || "n/a"}
  <Table.Row>
    <Table.Cell class="font-medium">{regPrefix(thisAddress)}</Table.Cell>
    <Table.Cell class="font-mono">{HEX(thisAddress, 4)}</Table.Cell>
    <Table.Cell class="truncate">
      {name}
    </Table.Cell>
    <Table.Cell class="text-right font-mono">{v ? 1 : 0}</Table.Cell>
    <Table.Cell
      class="font-mono {v
        ? 'text-green-500 bg-green-100'
        : 'text-red-500 bg-red-100'}">{v ? "true" : "false"}</Table.Cell
    >
  </Table.Row>
{/snippet}
<Collapsible.Root class="w-full">
  <Card.Root class="w-full m-0">
    <Card.Header class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <h3 class="truncate font-semibold">
          {type.replace(/_/g, " ")}
        </h3>
      </div>

      <form class="flex flex-wrap items-end gap-3" onsubmit={writeData}>
        <div class="flex max-w-sm flex-col gap-1.5">
          <Label for={id + "-write-panel-address"} class="text-muted-foreground"
            >Start Address</Label
          >
          <div style="position: relative;">
            <HexInput
              id={id + "-write-panel-address"}
              bind:value={address}
              max={0xffff}
              display="auto"
              placeholder="0x0000"
              class="h-9 w-40"
            />
            <p
              class="text-muted-foreground text-xs"
              style="position: absolute; left: 0; top: 100%; margin-top: 2px;"
            >
              {#if addressResolved}
                {addressResolved}
              {/if}
            </p>
          </div>
        </div>

        <div class="flex max-w-sm flex-col gap-1.5">
          <Label for={id + "-write-panel-values"} class="text-muted-foreground">Add values</Label>
          {#if type === "write_coils"}
            <BinaryArrayInput
              id={id + "-write-panel-values"}
              bind:value={bitValues}
              class="h-9 w-40"
              inputClass="w-full"
            />
          {:else if type === "write_registers"}
            <HexArrayInput
              id={id + "-write-panel-values"}
              bind:value={wordValues}
              max={0xffff}
              display="auto"
              placeholder="0x0000"
              inputClass="h-9 w-40"
            />
          {/if}
        </div>

        <div class="flex items-center gap-1.5">
          <Button id={id + "-write-panel-submit"} onclick={writeData} aria-label="write">Write</Button>

          <Collapsible.Trigger>
            <Button

              variant="ghost"
              size="icon"
              aria-label={open ? "Minimize" : "Maximize"}
            >
              <ChevronUp
                class={`size-4 transition-transform${!open ? " rotate-180" : ""}`}
              />
            </Button>
          </Collapsible.Trigger>
        </div>
      </form>
    </Card.Header>
    <Card.Content>
      <blockquote class="border-l-2 text-muted-foreground text-sm italic">
        {#if showToastMessage}
          {#if status.error}
            <span class="text-red-500">{status.msg}</span>
          {:else}
            <span class="text-green-500">{status.msg}</span>
          {/if}
        {:else}
          <span
            class="inline-flex items-center text-background-muted gap-1 rounded-md px-2 py-0.5 font-mono"
          >
            {functionDisplayName()}
          </span>
          <span
            class="inline-flex items-center bg-outline gap-1 rounded-md px-2 py-0.5 font-mono"
          >
            <span>{HEX(address)}</span>
            <span class="opacity-60"><bold>{regPrefix(address)}</bold></span>
          </span>
          {#each rightValues as v, i (i)}
            <span
              class="inline-flex items-center gap-1 rounded-md bg-secondary text-primary px-2 py-0.5 font-mono"
            >
              {#if type === "write_registers"}
                <span>{v}</span>
                <span class="opacity-60">({HEX(v as number)})</span>
              {:else if type === "write_coils"}
                <span>{v ? 1 : 0}</span>
                <span class="opacity-60">({v})</span>
              {/if}
            </span>
          {/each}
        {/if}
      </blockquote>
    </Card.Content>
    <Collapsible.Content>
      <Separator orientation="horizontal" />
      <Card.Footer class="flex flex-col gap-4 items-start">
        <span class="text-muted-foreground text-sm pt-4"
          >Preview of write operation</span
        >
        <Table.Root class="w-full bg-blue-50 dark:bg-blue-900/20">
          <Table.Header>
            {#if type === "write_registers"}
              <Table.Row>
                <Table.Head class="w-24">Reg.</Table.Head>
                <Table.Head class="w-28">Address</Table.Head>
                <Table.Head>Name</Table.Head>
                <Table.Head class="w-24 text-right">Decimal</Table.Head>
                <Table.Head class="w-24">Bool</Table.Head>
                <Table.Head class="w-24">Binary</Table.Head>
              </Table.Row>
            {:else if type === "write_coils"}
              <Table.Row>
                <Table.Head class="w-24">Reg.</Table.Head>
                <Table.Head class="w-28">Address</Table.Head>
                <Table.Head>Name</Table.Head>
                <Table.Head class="w-24 text-right">Bin</Table.Head>
                <Table.Head class="w-24">Bool</Table.Head>
              </Table.Row>
            {/if}
          </Table.Header>

          <Table.Body>
            {#if type === "write_registers"}
              {#if rightValues.length === 0}
                <Table.Row>
                  <Table.Cell class="font-medium"
                    >{regPrefix(address)}</Table.Cell
                  >
                  <Table.Cell class="font-mono">{HEX(address, 4)}</Table.Cell>
                  <Table.Cell class="text-blue-500 text-right font-mono"
                  ></Table.Cell>
                  <Table.Cell class="text-blue-500 font-mono"></Table.Cell>
                  <Table.Cell class="text-blue-500 font-mono"></Table.Cell>
                </Table.Row>
              {:else}
                {#each wordValues as v, i (i)}
                  {@const thisAddress = address + i}
                  {@render registerTableRow(thisAddress, v, i)}
                {/each}
              {/if}
            {:else if type === "write_coils"}
              {#if rightValues.length === 0}
                <Table.Row>
                  <Table.Cell class="font-medium"
                    >{regPrefix(address)}</Table.Cell
                  >
                  <Table.Cell class="font-mono">{HEX(address, 4)}</Table.Cell>
                  <Table.Cell class="text-blue-500 text-right font-mono"
                  ></Table.Cell>
                  <Table.Cell class="text-blue-500 font-mono"></Table.Cell>
                </Table.Row>
              {:else}
                {#each bitValues as v, i (i)}
                  {@const thisAddress = address + i}
                  {@render coilTableRow(thisAddress, v, i)}
                {/each}
              {/if}
            {/if}
          </Table.Body>
        </Table.Root>
        <div class="w-full pt-4">
          <Separator orientation="horizontal" />
        </div>

        <div class="flex items-end gap-3 pt-4">
          <div class="flex flex-col gap-1.5">
            <Label for={id + "-write-panel-shortcut-name"} class="text-muted-foreground"
              >Shortcut name</Label
            >
            <TagInput
              id={id + "-write-panel-shortcut-name"}
              placeholder="RESTART_SYSTEM"
              bind:value={shortcutName}
              class="w-64"
            />
          </div>

          <Button
            id={id + "-write-panel-save-shortcut"}
            onclick={saveShortcut}
            aria-label="Save write as shortcut"
            disabled={rightValues.length === 0}
          >
            Save as Shortcut
          </Button>
        </div>
      </Card.Footer>
    </Collapsible.Content>
  </Card.Root>
</Collapsible.Root>
