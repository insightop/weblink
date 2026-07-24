import { describe, it, expect } from "vitest";
import { DriverRegistry } from "./registry";
import { XboxDriver } from "./XboxDriver";
import { GenericDriver } from "./GenericDriver";

/**
 * 注意：specific 驱动（Xbox）必须在 GenericDriver 之前注册，
 * 因为 GenericDriver.detect() 对所有手柄都返回 true。
 */
describe("DriverRegistry", () => {
  it("detects Xbox driver first", () => {
    const registry = new DriverRegistry();
    registry.register(new XboxDriver());
    registry.register(new GenericDriver());

    const fake = { id: "Xbox 360 Controller" } as Gamepad;
    const driver = registry.detect(fake);
    expect(driver.id).toBe("xbox");
  });

  it("falls back to generic for unknown controllers", () => {
    const registry = new DriverRegistry();
    registry.register(new XboxDriver());
    registry.register(new GenericDriver());

    const fake = { id: "Unknown Controller" } as Gamepad;
    const driver = registry.detect(fake);
    expect(driver.id).toBe("generic");
  });

  it("lists all registered drivers", () => {
    const registry = new DriverRegistry();
    registry.register(new XboxDriver());
    registry.register(new GenericDriver());
    expect(registry.list()).toHaveLength(2);
  });

  it("register replaces driver with same id", () => {
    const registry = new DriverRegistry();
    registry.register(new GenericDriver());
    registry.register(new XboxDriver());
    registry.register(new XboxDriver()); // replace
    expect(registry.list()).toHaveLength(2);
  });
});
