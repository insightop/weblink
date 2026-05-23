import { globalPluginRegistry } from "../registry";
import { ch32SerialPlugin } from "./ch32Serial.plugin";
import { esp32SerialPlugin } from "./esp32Serial.plugin";
import { gd32DfuPlugin } from "./gd32Dfu.plugin";
import { gd32SerialPlugin } from "./gd32Serial.plugin";
import { stm32DaplinkPlugin } from "./stm32Daplink.plugin";
import { stm32DfuPlugin } from "./stm32Dfu.plugin";
import { stm32SerialPlugin } from "./stm32Serial.plugin";
import { stm32StlinkPlugin } from "./stm32Stlink.plugin";

export function registerBuiltinPlugins(): void {
  globalPluginRegistry.register(stm32SerialPlugin);
  globalPluginRegistry.register(stm32DfuPlugin);
  globalPluginRegistry.register(stm32StlinkPlugin);
  globalPluginRegistry.register(stm32DaplinkPlugin);
  globalPluginRegistry.register(esp32SerialPlugin);
  globalPluginRegistry.register(gd32SerialPlugin);
  globalPluginRegistry.register(gd32DfuPlugin);
  globalPluginRegistry.register(ch32SerialPlugin);
}
