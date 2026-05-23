import type { IpKitCapabilities } from "../infrastructure/browser/detectCapabilities";
import type { IpToolDefinition } from "./types";

export class IpToolRegistry {
  private readonly tools = new Map<string, IpToolDefinition>();

  register(tool: IpToolDefinition): void {
    this.tools.set(tool.id, tool);
  }

  listVisible(caps: IpKitCapabilities): IpToolDefinition[] {
    return [...this.tools.values()]
      .filter((t) => t.showInMenu && t.isSupported(caps))
      .sort((a, b) => a.order - b.order);
  }

  listAll(): IpToolDefinition[] {
    return [...this.tools.values()].sort((a, b) => a.order - b.order);
  }

  getByPath(path: string): IpToolDefinition | undefined {
    return [...this.tools.values()].find((t) => t.path === path);
  }
}

export const globalIpToolRegistry = new IpToolRegistry();
