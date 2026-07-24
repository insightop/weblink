import { describe, it, expect } from "vitest";
import { XboxDriver } from "./XboxDriver";

describe("XboxDriver", () => {
  const driver = new XboxDriver();

  it("detects Xbox controller by id", () => {
    const fake = { id: "Xbox 360 Controller (XInput STANDARD GAMEPAD)" } as Gamepad;
    expect(driver.detect(fake)).toBe(true);
  });

  it("detects Xbox Series controller", () => {
    const fake = { id: "Xbox Series X Controller" } as Gamepad;
    expect(driver.detect(fake)).toBe(true);
  });

  it("rejects non-Xbox id", () => {
    const fake = { id: "PS4 Controller" } as Gamepad;
    expect(driver.detect(fake)).toBe(false);
  });

  it("maps standard buttons correctly", () => {
    expect(driver.mapButton(0)?.name).toBe("a");
    expect(driver.mapButton(1)?.name).toBe("b");
    expect(driver.mapButton(2)?.name).toBe("x");
    expect(driver.mapButton(3)?.name).toBe("y");
    expect(driver.mapButton(4)?.name).toBe("leftShoulder");
    expect(driver.mapButton(5)?.name).toBe("rightShoulder");
    expect(driver.mapButton(6)?.name).toBe("leftTrigger");
    expect(driver.mapButton(7)?.name).toBe("rightTrigger");
  });

  it("maps analog triggers correctly", () => {
    expect(driver.mapButton(6)?.kind).toBe("analog");
    expect(driver.mapButton(7)?.kind).toBe("analog");
    expect(driver.mapButton(0)?.kind).toBe("digital");
  });

  it("maps axes correctly", () => {
    expect(driver.mapAxis(0)?.name).toBe("leftStickX");
    expect(driver.mapAxis(1)?.name).toBe("leftStickY");
    expect(driver.mapAxis(2)?.name).toBe("rightStickX");
    expect(driver.mapAxis(3)?.name).toBe("rightStickY");
  });

  it("returns layout with buttons and axes", () => {
    const layout = driver.getLayout();
    expect(layout.type).toBe("xbox");
    expect(layout.buttons.length).toBeGreaterThan(0);
    expect(layout.axes.length).toBeGreaterThan(0);
  });
});
