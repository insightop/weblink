<script lang="ts">
  import * as Alert from "$lib/components/ui/alert";
  import { setContext, onDestroy } from "svelte";
  import {
    ALERT_CTX,
    type ShowAlertFn,
    type AlertVariant,
    type ShowAlertOptions,
    type AlertHandle,
    registerAlertShow,
    unregisterAlertShow,
  } from "./context";
  import { fade } from "svelte/transition";
  import { X, Info, CircleCheck, TriangleAlert } from "lucide-svelte";

  type Item = {
    id: number;
    title?: string;
    message?: string;
    variant: AlertVariant;     // "success" | "info" | "error"
    duration: number;          // ms; <0 => sticky
    timer?: number;
  };

  let list = $state<Item[]>([]);
  let counter = $state(0);

  function remove(id: number) {
    const it = list.find(x => x.id === id);
    if (it?.timer) clearTimeout(it.timer);
    list = list.filter(x => x.id !== id);
  }

  function show(opts: ShowAlertOptions): AlertHandle {
    const id = ++counter;
    const item: Item = {
      id,
      variant: opts.variant ?? "info",
      title: opts.title,
      message: opts.message,
      duration: opts.duration ?? 3200,
    };
    list = [...list, item];
    if (item.duration >= 0) {
      item.timer = setTimeout(() => remove(id), item.duration) as unknown as number;
    }
    return { id, close: () => remove(id) };
  }

  // expose for descendants and portals (via global)
  setContext(ALERT_CTX, show as ShowAlertFn);
  registerAlertShow(show as ShowAlertFn);
  onDestroy(() => unregisterAlertShow(show as ShowAlertFn));

  // minimal soft tints for info/success; error uses shadcn's destructive
  function tint(v: AlertVariant) {
    if (v === "success") {
      return "border-green-500/20 bg-green-50 text-green-900 dark:bg-green-900/15 dark:text-green-100";
    }
    if (v === "info") {
      return "border-blue-500/20 bg-blue-50 text-blue-900 dark:bg-blue-900/15 dark:text-blue-100";
    }
    return ""; // error handled by variant="destructive"
  }
</script>

<!-- Fixed bottom-center; very high z to sit above modals; outer ignores clicks -->
<div class="pointer-events-none fixed inset-x-0 bottom-4 z-[2147483647] flex justify-center">
  <div class="flex w-full max-w-md flex-col gap-2 px-3">
    {#each list as a (a.id)}
      <div transition:fade={{ duration: 150 }}>
        <Alert.Root
          variant={a.variant === "error" ? "destructive" : "default"}
          role="status"
          aria-live="polite"
          class={"pointer-events-auto " + tint(a.variant)}
        >
          {#if a.variant === "success"}
            <CircleCheck class="h-4 w-4" />
          {:else if a.variant === "error"}
            <TriangleAlert class="h-4 w-4" />
          {:else}
            <Info class="h-4 w-4" />
          {/if}

          <!-- shadcn expects the text inside a div so it offsets next to the icon -->
          <div>
            {#if a.title}
              <Alert.Title class="text-sm font-medium break-words">
                {a.title}
              </Alert.Title>
            {/if}

            {#if a.message}
              <Alert.Description class="mt-1 text-sm whitespace-pre-wrap break-words">
                {a.message}
              </Alert.Description>
            {:else if !a.title}
              <Alert.Description class="text-sm">Alert</Alert.Description>
            {/if}
          </div>

          <!-- close button in the top-right corner -->
          <button
            class="absolute right-2 top-2 rounded p-1 opacity-70 transition-opacity hover:opacity-100"
            aria-label="Dismiss"
            title="Dismiss"
            onclick={() => remove(a.id)}
          >
            <X class="h-4 w-4" />
          </button>
        </Alert.Root>
      </div>
    {/each}
  </div>
</div>
