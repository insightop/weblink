<script lang="ts">
  import type { WebSerialOptions } from "modbus-webserial";
  import type { ConnectStatus } from "@/types/comp";
  import { Input } from "$lib/components/ui/input";
  import * as Select from "$lib/components/ui/select";
  import { Button } from "$lib/components/ui/button";
  import { Label } from "$lib/components/ui/label";
  import { Separator } from "$lib/components/ui/separator";
  import { Badge } from "$lib/components/ui/badge";
  import { defaultConfiguration, type ConnectionSettings } from "@/sys/system";

  let {
    status,
    onsubmit,
    ondisconnect,
    settings = $bindable<ConnectionSettings>(defaultConfiguration.connectionSettings),
  }: {
    status: ConnectStatus;
    onsubmit: () => Promise<void> | void;
    ondisconnect: () => void;
    settings: ConnectionSettings;
  } = $props();

  const disabled = $derived(status.status === "connecting" || status.status === "connected");

  // Select mirrors
  let sDataBits = $state<string>(String(settings.options?.dataBits ?? 8));
  let sStopBits = $state<string>(String(settings.options?.stopBits ?? 1));
  let parity    = $state<WebSerialOptions["parity"]>(settings.options?.parity ?? "none");

  // Sync mirrors on settings ref change; skip one push tick
  let lastSettingsRef = $state<ConnectionSettings | null>(null);
  let ignorePush = $state(true);

  $effect(() => {
    if (settings !== lastSettingsRef) {
      lastSettingsRef = settings;
      settings.options ??= {};
      const o = settings.options!;
      sDataBits = String(o.dataBits ?? 8);
      sStopBits = String(o.stopBits ?? 1);
      parity    = (o.parity ?? "none") as WebSerialOptions["parity"];
      ignorePush = true;
      queueMicrotask(() => { ignorePush = false; });
    }
  });

  // Push mirrors into settings (no dirty callback needed; parent watcher will see mutations)
  $effect(() => {
    if (ignorePush) return;
    const o = settings.options!;
    const db = Number(sDataBits) as 7 | 8;
    if (o.dataBits !== db) o.dataBits = db;
    const sb = Number(sStopBits) as 1 | 2;
    if (o.stopBits !== sb) o.stopBits = sb;
    if (o.parity !== parity) o.parity = parity;
  });

  function submitForm(e: Event) {
    e.preventDefault();
    onsubmit();
  }
</script>

<header class="w-full border-b">
  <div class="flex items-center pl-4 pr-4 gap-3 h-22">
    <!-- LEFT: badge + status -->
    <div class="flex flex-1 min-w-0 items-center gap-3">
      <div class="flex items-center">
        {#if status.status === "connected"}
          <Badge variant="secondary" class="bg-green-500 text-white">Connected</Badge>
        {:else if status.status === "disconnected"}
          <Badge variant="secondary">Disconnected</Badge>
        {:else if status.status === "idle"}
          <Badge variant="outline">Idle</Badge>
        {:else if status.status === "connecting"}
          <Badge variant="secondary">Connecting...</Badge>
        {/if}
      </div>

      <p class="flex-1 min-w-0 text-sm text-muted-foreground whitespace-pre-wrap break-words">
        {status.msg.length === 0 ? "No message available" : status.msg}
      </p>
    </div>

    <!-- vertical separator -->
    <Separator orientation="vertical" class="!h-[70%] mr-2"/>

    <!-- RIGHT: form -->
    <form class="flex flex-wrap items-center gap-3" onsubmit={submitForm}>
      <fieldset {disabled} class="contents">
        <!-- DEVICE ID -->
        <div class="flex max-w-sm flex-col gap-1.5">
          <Label for="connect-device-id" class="text-xs text-muted-foreground">Device ID</Label>
          <Input id="connect-device-id" type="number" min="0" max="255" bind:value={settings.deviceId} class="h-9 w-24" />
        </div>

        <!-- BAUD RATE -->
        <div class="flex max-w-sm flex-col gap-1.5">
          <Label for="connect-baud-rate" class="text-xs text-muted-foreground">Baud rate</Label>
          <Input id="connect-baud-rate" type="number" min="1200" step="100" bind:value={settings.options.baudRate} class="h-9 w-28" />
        </div>

        <!-- DATA BITS -->
        <div class="flex min-w-[20px] flex-col gap-1.5">
          <Label for="connect-data-bits" class="text-xs text-muted-foreground">Data bits</Label>
          <Select.Root type="single" bind:value={sDataBits}>
            <Select.Trigger id="connect-data-bits" class="h-9 capitalize">{sDataBits}</Select.Trigger>
            <Select.Content>
              <Select.Item value="7">7</Select.Item>
              <Select.Item value="8">8</Select.Item>
            </Select.Content>
          </Select.Root>
        </div>

        <!-- PARITY -->
        <div class="flex min-w-[20px] flex-col gap-1.5">
          <Label for="connect-parity" class="text-xs text-muted-foreground">Parity</Label>
          <Select.Root type="single" bind:value={parity}>
            <Select.Trigger id="connect-parity" class="h-9 capitalize">{parity}</Select.Trigger>
            <Select.Content>
              <Select.Item value="none">none</Select.Item>
              <Select.Item value="even">even</Select.Item>
              <Select.Item value="odd">odd</Select.Item>
            </Select.Content>
          </Select.Root>
        </div>

        <!-- STOP BITS -->
        <div class="flex min-w-[20px] flex-col gap-1.5">
          <Label for="connect-stop-bits" class="text-xs text-muted-foreground">Stop bits</Label>
          <Select.Root type="single" bind:value={sStopBits}>
            <Select.Trigger id="connect-stop-bits" class="h-9 capitalize">{sStopBits}</Select.Trigger>
            <Select.Content>
              <Select.Item value="1">1</Select.Item>
              <Select.Item value="2">2</Select.Item>
            </Select.Content>
          </Select.Root>
        </div>
      </fieldset>

      <div class="flex min-w-[20px] flex-col gap-1.5">
        <span class="text-xs">&nbsp;</span>
        {#if status.status === "connected"}
          <Button id="connect-disconnect" variant="outline" class="h-9" onclick={ondisconnect} disabled={false}>Disconnect</Button>
        {:else}
          <Button id="connect-submit" type="submit" class="h-9">Connect</Button>
        {/if}
      </div>
    </form>
  </div>
</header>
