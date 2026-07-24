import type { GamepadDriver } from "./types";
import { XboxDriver } from "./XboxDriver";
import { GenericDriver } from "./GenericDriver";

/**
 * DriverRegistry — 驱动注册表。
 *
 * 采用策略模式 + 注册表，每次添加新手柄驱动只需：
 * ```ts
 * registry.register(new PlayStationDriver());
 * ```
 *
 * detect() 会按注册顺序依次尝试匹配，最先匹配成功的胜出，
 * 因此具体型号驱动应排在 GenericDriver 之前。
 */
export class DriverRegistry {
  private drivers: GamepadDriver[] = [];

  register(driver: GamepadDriver): void {
    // 同名驱动替换
    const idx = this.drivers.findIndex((d) => d.id === driver.id);
    if (idx >= 0) {
      this.drivers[idx] = driver;
    } else {
      this.drivers.push(driver);
    }
  }

  detect(gamepad: Gamepad): GamepadDriver {
    for (const d of this.drivers) {
      if (d.detect(gamepad)) return d;
    }
    // 最后兜底：返回 GenericDriver
    const generic = this.drivers.find((d) => d.id === "generic");
    return generic ?? this.drivers[0];
  }

  list(): ReadonlyArray<GamepadDriver> {
    return this.drivers;
  }
}

/** 全局单例 */
export const globalDriverRegistry = new DriverRegistry();

/** 注册内置驱动 */
export function initGamepadDrivers(): void {
  globalDriverRegistry.register(new XboxDriver());
  globalDriverRegistry.register(new GenericDriver());
}
