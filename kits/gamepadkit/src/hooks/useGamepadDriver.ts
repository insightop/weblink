import { useMemo } from "react";
import { useGamepadState } from "./useGamepadState";
import { globalDriverRegistry } from "../drivers/registry";
import type { GamepadDriver } from "../drivers/types";

/**
 * useGamepadDriver — 自动检测手柄对应的驱动。
 *
 * 连接手柄后自动识别型号并返回对应驱动实例，
 * 可用于获取布局信息、映射表等。
 *
 * ```tsx
 * const driver = useGamepadDriver(0);
 * const layout = driver?.getLayout();
 * ```
 */
export function useGamepadDriver(index: number): GamepadDriver | null {
  const state = useGamepadState(index);

  return useMemo(() => {
    if (!state) return null;
    return globalDriverRegistry.detect({
      index: state.index,
      id: state.id,
      mapping: state.mapping,
      connected: state.connected,
      timestamp: state.timestamp,
    } as unknown as Gamepad);
  }, [state]);
}
