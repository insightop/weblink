import { useEffect, useSyncExternalStore } from "react";
import { GamepadManager, gamepadManager } from "../core/GamepadManager";
import type { EnhancedGamepadState } from "../core/types";

interface UseGamepadsReturn {
  gamepads: EnhancedGamepadState[];
  connectedCount: number;
  supported: boolean;
}

/**
 * useGamepads — 根 hook。
 *
 * 管理所有手柄的连接/断开检测与状态轮询。
 * 浏览器不支持 Gamepad API 时返回 supported: false。
 *
 * ```tsx
 * const { gamepads, connectedCount, supported } = useGamepads();
 * ```
 */
export function useGamepads(): UseGamepadsReturn {
  const supported = GamepadManager.supported();

  const states = useSyncExternalStore(
    (cb) => gamepadManager.subscribe(cb),
    () => gamepadManager.getAllStates(),
  );

  useEffect(() => {
    if (!supported) return;
    gamepadManager.start();
    return () => gamepadManager.stop();
  }, [supported]);

  const gamepads = Array.from(states.values()).filter((g) => g.connected);

  return {
    gamepads,
    connectedCount: gamepads.length,
    supported,
  };
}
