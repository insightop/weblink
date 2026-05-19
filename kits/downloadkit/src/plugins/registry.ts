import type { FlasherPlugin, PluginResolveCriteria } from "@/plugins/types";

export interface TargetFlasherOption {
  plugin: FlasherPlugin;
  isSupported: boolean;
}

export class PluginRegistry {
  private readonly plugins = new Map<string, FlasherPlugin>();

  register(plugin: FlasherPlugin): void {
    this.plugins.set(plugin.id, plugin);
  }

  unregister(id: string): void {
    this.plugins.delete(id);
  }

  list(): FlasherPlugin[] {
    return [...this.plugins.values()].sort((a, b) => b.priority - a.priority);
  }

  resolve(criteria: PluginResolveCriteria): FlasherPlugin {
    const candidate = this.tryResolve(criteria);
    if (!candidate) {
      throw new Error(`No plugin matched ${criteria.chipFamily}/${criteria.flasherType}`);
    }
    return candidate;
  }

  tryResolve(criteria: PluginResolveCriteria): FlasherPlugin | null {
    return this.list().find((plugin) => plugin.supports(criteria)) ?? null;
  }

  listByTarget(criteria: Pick<PluginResolveCriteria, "chipFamily" | "capabilities">): TargetFlasherOption[] {
    return this.list()
      .filter((plugin) => plugin.chipFamily === criteria.chipFamily)
      .map((plugin) => ({
        plugin,
        isSupported: plugin.supports({
          chipFamily: criteria.chipFamily,
          flasherType: plugin.flasherType,
          capabilities: criteria.capabilities,
        }),
      }));
  }
}

export const globalPluginRegistry = new PluginRegistry();
