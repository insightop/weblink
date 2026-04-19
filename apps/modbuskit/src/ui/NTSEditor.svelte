<script lang="ts">
    import * as Card from "$lib/components/ui/card";
    import { Button } from "$lib/components/ui/button";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Separator } from "$lib/components/ui/separator";
    import * as Tabs from "$lib/components/ui/tabs";
    import NameMapEditor from "@/generics/NameMapEditor.svelte";

    import {
        fromSerializableNameBucketMap,
        toSerializableNameBucketMap,
        type NameBucketMap,
    } from "@/sys/system";

    // Edits a single NameBucketMap (iregs, hregs, coils, dinputs)
    let {
        initialData,
        onsave,
        ondelete,
        dirty = $bindable<boolean>(false),
    }: {
        initialData: NameBucketMap;
        onsave: (nts: NameBucketMap) => void;
        ondelete: () => void;
        dirty: boolean;
    } = $props();

    const toJson = (data: NameBucketMap) => {
        const ser = toSerializableNameBucketMap(data);
        const order = ["hregs", "iregs", "coils", "dinputs"] as const;

        const out: string[] = ["{"];
        /**
         * This is all to keep the json formatted as:
         *   "hregs": [
         *      [0, "first"],
         *      [1, "second"]
         *   ],
         * instead of:
         *    "iregs": [
         *      [
         *        0,
         *        "first"
         *      ],
         *      [
         *        1,
         *        "second"
         *      ]
         *   ],
         */
        order.forEach((k, i) => {
            // ensure stable numeric ordering
            const entries = [...(ser[k] as [number, string][])].sort(
                (a, b) => a[0] - b[0],
            );
            const isLastProp = i === order.length - 1;

            if (entries.length === 0) {
                out.push(`  "${k}": []${isLastProp ? "" : ","}`);
            } else {
                out.push(`  "${k}": [`);
                for (let j = 0; j < entries.length; j++) {
                    const [addr, name] = entries[j];
                    const isLast = j === entries.length - 1;
                    out.push(
                        `    [${addr}, ${JSON.stringify(name)}]${isLast ? "" : ","}`,
                    );
                }
                out.push(`  ]${isLastProp ? "" : ","}`);
            }
        });

        out.push("}");
        return out.join("\n");
    };
    const fromJson = (json: string) =>
        fromSerializableNameBucketMap(JSON.parse(json));

    /* Dirtiness tracking */
    // gate for ignoring changes during initial load
    let _ignoreDirty = true;
    // release the gate after the first microtask
    queueMicrotask(() =>
        requestAnimationFrame(() => {
            _ignoreDirty = false;
        })
    );

    // working copy + json text
    let working = $state<NameBucketMap>(structuredClone(initialData));
    let jsonText = $state<string>(toJson(initialData));
    let parseError = $state<string | null>(null);


    // When initialData changes (parent switches set), reset editor
    $effect(() => {
        working = structuredClone(initialData);
        jsonText = toJson(initialData);
        parseError = null;
        dirty = false;
        _ignoreDirty = true;
        queueMicrotask(() =>
            requestAnimationFrame(() => {
                _ignoreDirty = false;
            })
        );
    });

    // Keep JSON in sync when the table editors mutate `working`.
    // Avoid fighting user typing in the JSON area via a simple focus guard
    let jsonActive = $state(false);
    $effect(() => {
        void $state.snapshot(working);

        if (!_ignoreDirty) dirty = true;

        if (!jsonActive) {
            jsonText = toJson(working);
            parseError = null;
        }
    });
    let jsonDebounceTimeout: ReturnType<typeof setTimeout>;
    function applyFromJson() {
        clearTimeout(jsonDebounceTimeout);
        // JSON → working
        try {
            const parsed = fromJson(jsonText);
            working = structuredClone(parsed);
            parseError = null;
        } catch (err) {
            parseError = (err as Error).message;
        }
    }
    /* JSON -> working (manual paste/edit) */
    function onJsonInput(e: Event) {
        const el = e.target as HTMLTextAreaElement;
        jsonText = el.value;
        // Parse json with debounce to avoid too many updates
        clearTimeout(jsonDebounceTimeout);
        jsonDebounceTimeout = setTimeout(() => {
            applyFromJson();
        }, 1000);
    }

    /* Buttons */
    function resetToInitial() {
        working = structuredClone(initialData);
        jsonText = toJson(initialData);
        parseError = null;
    }
    function saveNow() {
        applyFromJson();
        if (parseError) return;
        dirty = false;
        onsave(working);
    }

    /* Tabs state */
    let tab = $state<"hregs" | "iregs" | "coils" | "dinputs">("hregs");

    const labels: Record<typeof tab, string> = {
        hregs: "Holding Registers",
        iregs: "Input Registers",
        coils: "Coils",
        dinputs: "Discrete Inputs",
    };
    let saveDisabled = $derived.by(() => {
        return parseError !== null || dirty === false;
    });
</script>

<Card.Root class="w-full">
    <Card.Header>
        <Card.Title>Name table set</Card.Title>
        <Card.Description class="text-sm text-muted-foreground">
            Edit via the table editor or paste JSON. Addresses are
            0x0000–0xFFFF.
        </Card.Description>
    </Card.Header>

    <Card.Content class="space-y-4">
        <!-- Tabs editor for each bucket -->
        <Tabs.Root bind:value={tab} class="w-full h-[500px]">
            <Tabs.List class="mb-2">
                <Tabs.Trigger value="hregs">Holding Regs</Tabs.Trigger>
                <Tabs.Trigger value="iregs">Input Regs</Tabs.Trigger>
                <Tabs.Trigger value="coils">Coils</Tabs.Trigger>
                <Tabs.Trigger value="dinputs">Discrete Inputs</Tabs.Trigger>
                <Tabs.Trigger value="json">Raw JSON</Tabs.Trigger>
            </Tabs.List>

            <Tabs.Content value="hregs" class="h-[420px] overflow-y-auto pr-2">
                <NameMapEditor
                    bind:value={working.hregs}
                    label={labels.hregs}
                />
            </Tabs.Content>

            <Tabs.Content value="iregs" class="h-[420px] overflow-y-auto pr-2">
                <NameMapEditor
                    bind:value={working.iregs}
                    label={labels.iregs}
                />
            </Tabs.Content>

            <Tabs.Content value="coils" class="h-[420px] overflow-y-auto pr-2">
                <NameMapEditor
                    bind:value={working.coils}
                    label={labels.coils}
                />
            </Tabs.Content>

            <Tabs.Content
                value="dinputs"
                class="h-[420px] overflow-y-auto pr-2"
            >
                <NameMapEditor
                    bind:value={working.dinputs}
                    label={labels.dinputs}
                />
            </Tabs.Content>

            <Tabs.Content value="json" class="h-[420px]">
                <div class="space-y-2">
                    <p class="text-sm text-muted-foreground">Raw JSON</p>
                    <Textarea
                        class="h-[420px] font-mono text-sm overflow-y-auto pr-2 bg-muted text-muted-foreground"
                        bind:value={jsonText}
                        onfocus={() => (jsonActive = true)}
                        onblur={() => ((jsonActive = false), applyFromJson())}
                        oninput={onJsonInput}
                        spellcheck="false"
                        autocapitalize="off"
                        autocomplete="off"
                    />
                    {#if parseError}
                        <p class="text-sm text-destructive">
                            Invalid JSON: {parseError}
                        </p>
                    {/if}
                </div>  
            </Tabs.Content>
        </Tabs.Root>
    </Card.Content>     
    <Card.Footer class="flex items-center gap-2">
        <Button variant="secondary" onclick={resetToInitial}>Reset</Button>
        <Separator orientation="vertical" class="h-6" />
        <Button onclick={saveNow} disabled={saveDisabled}>Save</Button>
        <span class="text-xs text-muted-foreground">
            {dirty ? "Unsaved changes" : ""}
        </span>
        <div class="ml-auto">
            <Button variant="destructive" onclick={ondelete}>Delete set…</Button>
        </div>
    </Card.Footer>
</Card.Root>

