<script lang="ts">
  import {
    HEX,
    regPrefixes,
    type ReadFunction,
    type ReadMethod,
    type ReadResponse,
    type RPanelSettings,
  } from "@/sys/panels";
  import { formatMs } from "@/sys/generic";
  import { getContext } from "svelte";

  import * as Card from "$lib/components/ui/card";
  import * as Collapsible from "$lib/components/ui/collapsible";
  import { Separator } from "$lib/components/ui/separator";
  import { Button } from "$lib/components/ui/button";
  import { Label } from "$lib/components/ui/label";
  import { Input } from "$lib/components/ui/input";
  import { ChevronUp, RefreshCcw } from "lucide-svelte";
  import { Checkbox } from "$lib/components/ui/checkbox";
  import HexInput from "@/generics/custom-input/HexInput.svelte";
  import BitTable from "@/generics/BitTable.svelte";
  import WordTable from "@/generics/WordTable.svelte";
  import * as Alert from "$lib/components/ui/alert";
  import {
    nameTableCategoryFromFunctionType,
    type NameTableSet,
  } from "@/sys/system";
  let {
    id,
    type,
    name,
    nts,
  }: { id: string; type: ReadFunction; name?: string; nts: NameTableSet } = $props();

  let lastRes = $state<ReadResponse | null>(null);
  let errorMsg = $state<string | null>(null);
  let lastRefreshTimestamp = $state<number | null>(null);
  let elapsedSinceLastRefresh = $derived(
    lastRefreshTimestamp ? Date.now() - lastRefreshTimestamp : 0
  );

  const readFromClient = getContext<ReadMethod>("readFromClient");
  $effect(() => {
    if (settings.autoRefresh) {
      const interval = setInterval(() => {
        refreshData();
      }, settings.autoRefreshInterval);
      return () => clearInterval(interval);
    }
  });
  // Update the last refresh timestamp every second
  $effect(() => {
    const step = 1000;
    const interval = setInterval(() => {
      elapsedSinceLastRefresh = lastRefreshTimestamp
        ? Date.now() - lastRefreshTimestamp
        : 0;
    }, step);
    return () => clearInterval(interval);
  });
  function refreshData() {
    flash = true;
    setTimeout(() => (flash = false), 450); // Flash for 450ms
    readFromClient(settings.queryTemplate)
      .then((response) => {
        lastRefreshTimestamp = Date.now();
        lastRes = response;
        errorMsg = null;
      })
      .catch((error) => {
        console.error(
          "Error reading from client:",
          $state.snapshot(settings.queryTemplate),
          error
        );
        errorMsg = error.message;
      });
  }

  let settings: RPanelSettings = $state<RPanelSettings>({
    queryTemplate: {
      type,
      address: 0,
      quantity: 10,
    },
    autoRefreshInterval: 2000,
    autoRefresh: false,
  });

  let open = $state(true);

  const skeletonRes = () => {
    return {
      fromFunction: type,
      startAddress: settings.queryTemplate.address,
      data: Array(settings.queryTemplate.quantity).fill(null),
    } as ReadResponse;
  };

  let flash = $state(false);
  let nameBucket = $derived(nts.names[nameTableCategoryFromFunctionType[type]]);
  let addressResolved = $derived(
    nameBucket.get(settings.queryTemplate.address)
  );

</script>

<Collapsible.Root class="w-full">
  <Card.Root class="w-full">
    <Card.Header class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <h3 class="truncate font-semibold">
          {name ?? type.replace(/_/g, " ")}
        </h3>
        {#if name}
          <p class="text-xs text-muted-foreground">
            {type.replace(/_/g, " ")}
          </p>
        {/if}
      </div>
      <!-- ADDRESS -->
      <form class="flex flex-wrap items-end gap-3" onsubmit={refreshData}>
        <div class="flex max-w-sm flex-col gap-1.5">
          <Label for={id + "-read-panel-address"} class="text-muted-foreground">Address</Label>
          <div style="position: relative;">
            <HexInput
              id={id + "-read-panel-address"}
              bind:value={settings.queryTemplate.address}
              max={0xffff}
              display="auto"
              placeholder="0x0000"
              class="h-9 w-40"
            />
            <p
              class="text-muted-foreground text-xs"
              style="position: absolute; left: 0; top: 100%; margin-top: 2px;"
            >
              <bold
                >{regPrefixes[type] +
                  `${settings.queryTemplate.address + 1}`}</bold
              >
              {#if addressResolved}
                {addressResolved}
              {/if}
            </p>
          </div>
        </div>
        <!-- QUANTITY -->
        <div class="flex max-w-sm flex-col gap-1.5">
          <Label for={id + "-read-panel-quantity"} class="text-muted-foreground">Quantity</Label>
          <Input
            id={id + "-read-panel-quantity"}
            type="number"
            min="1"
            bind:value={settings.queryTemplate.quantity}
            class="h-9 w-15"
          />
        </div>
        <!-- INTERVAL -->
        <div class="flex max-w-sm flex-col gap-1.5">
          <Label for="interval" class="text-muted-foreground">
            <Checkbox id={id + "-read-panel-autorefresh"} bind:checked={settings.autoRefresh} />
            <Label for={id + "-read-panel-autorefresh"}>Auto refresh</Label>
          </Label>
          <Input
            id={id + "-read-panel-interval"}
            type="number"
            min="100"
            bind:value={settings.autoRefreshInterval}
            disabled={!settings.autoRefresh}
            class="h-9 w-25"
          />
        </div>
        <!-- REFRESH AND COLLAPSE -->
        <div class="flex items-center gap-1.5">
          <Button
            id={id + "-read-panel-refresh"}
            variant="ghost"
            size="icon"
            onclick={refreshData}
            aria-label="Refresh"
          >
            <RefreshCcw class="size-4" />
          </Button>

          <Collapsible.Trigger>
            <Button
              id={id + "-read-panel-collapse"}
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
    <Collapsible.Content>
      <Separator orientation="horizontal" />
      <div class="p-5 {flash ? 'flash' : ''}">
        <Alert.Root
          variant={errorMsg ? "destructive" : "default"}
          class="bg-transparent"
        >
          {#if lastRes}
            <Alert.Title>
              <code>{lastRes.fromFunction}</code>
              {lastRes.data.length} registers from {HEX(
                lastRes.startAddress,
                4
              )} to {HEX(lastRes.startAddress + lastRes.data.length - 1, 4)}
            </Alert.Title>
            <Alert.Description class="text-sm text-muted-foreground">
              {errorMsg ?? "Successful read"} <br />
              {formatMs(elapsedSinceLastRefresh)} ago
            </Alert.Description>
          {:else}
            <Alert.Title>No data yet</Alert.Title>
            <Alert.Description class="text-sm text-muted-foreground">
              Click "Refresh" to load data.
            </Alert.Description>
          {/if}
        </Alert.Root>
        {#if type === "read_coils" || type === "read_discrete_inputs"}
          <BitTable
            bits={lastRes
              ? (lastRes.data as boolean[])
              : (skeletonRes().data as boolean[])}
            startAddress={lastRes
              ? lastRes.startAddress
              : settings.queryTemplate.address}
            regPrefix={regPrefixes[type]}
            names={nameBucket}
          />
        {:else if type === "read_holding_registers" || type === "read_input_registers"}
          <WordTable
            words={lastRes
              ? (lastRes.data as number[])
              : (skeletonRes().data as number[])}
            startAddress={lastRes
              ? lastRes.startAddress
              : settings.queryTemplate.address}
            regPrefix={regPrefixes[type]}
            names={nameBucket}
          />
        {/if}
      </div>
    </Collapsible.Content>
  </Card.Root>
</Collapsible.Root>

<style>
  .flash {
    animation: flash 0.45s ease-in-out;
  }

  @keyframes flash {
    0% {
      background: rgba(0, 0, 255, 0.02);
    }
    100% {
      background: transparent;
    }
  }
</style>
