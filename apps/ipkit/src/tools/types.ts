import type { IpKitCapabilities } from "@/infrastructure/browser/detectCapabilities";

export interface IpToolDefinition {
  id: string;
  label: string;
  path: string;
  /** 侧栏展示顺序，越小越靠前 */
  order: number;
  /** 是否在导航中显示（仍可通过 URL 直达） */
  showInMenu: boolean;
  isSupported: (caps: IpKitCapabilities) => boolean;
}
