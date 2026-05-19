import { globalPluginRegistry } from "@/plugins/registry";
import { ch32SerialPlugin } from "@/plugins/builtin/ch32Serial.plugin";
import { esp32SerialPlugin } from "@/plugins/builtin/esp32Serial.plugin";
import { gd32DfuPlugin } from "@/plugins/builtin/gd32Dfu.plugin";
import { gd32SerialPlugin } from "@/plugins/builtin/gd32Serial.plugin";
import { stm32DaplinkPlugin } from "@/plugins/builtin/stm32Daplink.plugin";
import { stm32DfuPlugin } from "@/plugins/builtin/stm32Dfu.plugin";
import { stm32SerialPlugin } from "@/plugins/builtin/stm32Serial.plugin";
import { stm32StlinkPlugin } from "@/plugins/builtin/stm32Stlink.plugin";

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
