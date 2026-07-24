import { useSyncExternalStore, useMemo } from "react";
import { gamepadManager } from "../core/GamepadManager";
import type { EnhancedGamepadState } from "../core/types";

/**
 * useGamepadState — 订阅单个手柄的完整状态。
 *
 * ```tsx
 * const state = useGamepadState(0);
 * if (!state) return <p>未连接</p>;
 * console.log(state.mapped.buttons.a); // 0.0 ~ 1.0
 * ```
 */
export function useGamepadState(index: number): EnhancedGamepadState | null {
  const subscribe = useMemo(
    () => (cb: () => void) => gamepadManager.subscribe(() => cb()),
    [],
  );

  const getSnapshot = useMemo(
    () => () => gamepadManager.getState(index) ?? null,
    [index],
  );

  return useSyncExternalStore(subscribe, getSnapshot);
}
