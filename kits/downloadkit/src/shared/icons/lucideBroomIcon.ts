/**
 * Lucide Lab 官方 `broom` 图标，通过 `createLucideIcon` 固化为组件，
 * 避免在 Naive `NButton` 图标槽中对泛型 `<Icon :icon-node="…" />` 传参丢失。
 */
import { createLucideIcon } from "@lucide/vue";
import { broom } from "@lucide/lab";

export const LucideBroomIcon = createLucideIcon("broom", broom);
