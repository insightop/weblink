<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { NButton, NCard, NDivider, NInputNumber, NRadioButton, NRadioGroup, NSelect, NSpace, NText, NUpload, NUploadDragger, useMessage } from "naive-ui";
import type { UploadFileInfo } from "naive-ui";
import { FlashWorkbenchFacade } from "../../application/FlashWorkbenchFacade";
import type { BusKind } from "../../matrix/types";
import type { SpiNorProfile } from "../../domain/spi/nor/SpiNorProfile";
import { FlashKitError } from "../../domain/errors/FlashKitError";
import { uint8ToHex } from "../../shared/hex/uint8";
import FlashLogPanel from "../logs/FlashLogPanel.vue";
import {
  WORKBENCH_ADAPTER_OPTIONS,
  adapterSupportsBusInCells,
  resolveMatrixCell,
  type WorkbenchAdapterId,
} from "./workbenchAdapterUi";

const message = useMessage();
const facade = new FlashWorkbenchFacade();

const logs = ref<string[]>([]);
function log(line: string): void {
  logs.value = [...logs.value, `${new Date().toISOString()}  ${line}`].slice(-200);
}

const usbOk = computed(() => "usb" in navigator);
const hidOk = computed(() => "hid" in navigator);

const matrixCells = facade.listMatrixCells();
const busy = ref(false);

const selectedAdapterId = ref<WorkbenchAdapterId>("ch341");
const bus = ref<BusKind>("spi");

function pickDefaultBusForAdapter(id: WorkbenchAdapterId): BusKind {
  if (adapterSupportsBusInCells(matrixCells, id, "spi")) return "spi";
  return "i2c";
}

watch(selectedAdapterId, (id) => {
  if (!adapterSupportsBusInCells(matrixCells, id, bus.value)) {
    bus.value = pickDefaultBusForAdapter(id);
  }
});

const selectedCell = computed(() => resolveMatrixCell(matrixCells, selectedAdapterId.value, bus.value));

const adapterSelectOptions = WORKBENCH_ADAPTER_OPTIONS.map((o) => ({ label: o.label, value: o.id }));

const browserBlocksConnection = computed(() => {
  const c = selectedCell.value;
  if (!c) return true;
  if (c.transport === "webusb") return !usbOk.value;
  return !hidOk.value;
});

const connectionHint = computed(() => {
  if (!selectedCell.value) {
    return "该编程器与当前协议组合不可用，请更换选项。";
  }
  if (browserBlocksConnection.value) {
    return "当前浏览器无法连接所选编程器，请换用 Chrome / Edge 等并确保为 HTTPS 或 localhost。";
  }
  return null;
});

function canConnect(): boolean {
  return !!(selectedCell.value && !browserBlocksConnection.value);
}

async function onConnect(): Promise<void> {
  const c = selectedCell.value;
  if (!c) {
    message.warning("请选择有效的编程器与协议组合");
    return;
  }
  try {
    busy.value = true;
    if (c.transport === "webusb") {
      if (!c.usbFilters?.length) {
        message.error("内部配置错误：缺少 USB 过滤器");
        return;
      }
      await facade.requestUsbDevice([...c.usbFilters]);
    } else {
      if (!c.hidFilters?.length) {
        message.error("内部配置错误：缺少设备过滤器");
        return;
      }
      await facade.requestHidDevice([...c.hidFilters]);
    }
    await facade.openBridge(c.bridgeBackendId, c.bus);
    log(`已连接: ${facade.getState().deviceLabel ?? "?"}`);
    message.success("已连接设备");
  } catch (e) {
    log(`连接失败: ${String(e)}`);
    message.error(String(e));
  } finally {
    busy.value = false;
  }
}

const norProfile = ref<SpiNorProfile | null>(null);
const norOptions = facade.listNorProfiles().map((p) => ({ label: p.name, value: p.id }));
const selectedNorId = ref<string | null>(null);

watch(selectedNorId, (id) => {
  norProfile.value = facade.listNorProfiles().find((p) => p.id === id) ?? null;
});

const offset = ref(0);
const length = ref(256);

const eepromOffset = ref(0);
const eepromLength = ref(128);

async function onIdentifyNor(): Promise<void> {
  try {
    busy.value = true;
    const p = await facade.identifySpiNor();
    norProfile.value = p;
    selectedNorId.value = p.id;
    log(`识别 SPI NOR: ${p.name}`);
    message.success("识别成功");
  } catch (e) {
    const msg = e instanceof FlashKitError ? `${e.code}: ${e.message}` : String(e);
    log(`识别失败: ${msg}`);
    message.error(msg);
  } finally {
    busy.value = false;
  }
}

function resolveNorProfile(): SpiNorProfile | null {
  if (norProfile.value) return norProfile.value;
  const id = selectedNorId.value;
  return facade.listNorProfiles().find((p) => p.id === id) ?? null;
}

async function onReadNor(): Promise<void> {
  const profile = resolveNorProfile();
  if (!profile) {
    message.warning("请先识别或选择型号");
    return;
  }
  try {
    busy.value = true;
    const data = await facade.readSpiNor(profile, offset.value, length.value);
    log(`读取 SPI ${data.length} bytes: ${uint8ToHex(data, 64)}`);
    message.success("读取完成");
  } catch (e) {
    message.error(String(e));
    log(`读取失败: ${String(e)}`);
  } finally {
    busy.value = false;
  }
}

async function onProgramNor(file: UploadFileInfo | null): Promise<void> {
  const profile = resolveNorProfile();
  if (!profile) {
    message.warning("请先识别或选择型号");
    return;
  }
  if (!file?.file) {
    message.warning("请选择 bin 文件");
    return;
  }
  try {
    busy.value = true;
    const buf = new Uint8Array(await file.file.arrayBuffer());
    await facade.programSpiNor(profile, offset.value, buf);
    await facade.verifySpiNor(profile, offset.value, buf);
    log(`编程并校验完成，长度 ${buf.length}`);
    message.success("编程完成");
  } catch (e) {
    message.error(String(e));
    log(`编程失败: ${String(e)}`);
  } finally {
    busy.value = false;
  }
}

async function onReadEeprom(): Promise<void> {
  try {
    busy.value = true;
    const profile = facade.getDefaultEepromProfile();
    const data = await facade.readEeprom(profile, eepromOffset.value, eepromLength.value);
    log(`读取 EEPROM ${data.length} bytes: ${uint8ToHex(data, 64)}`);
    message.success("读取完成");
  } catch (e) {
    message.error(String(e));
    log(`读取失败: ${String(e)}`);
  } finally {
    busy.value = false;
  }
}

async function onProgramEeprom(file: UploadFileInfo | null): Promise<void> {
  if (!file?.file) {
    message.warning("请选择 bin 文件");
    return;
  }
  try {
    busy.value = true;
    const buf = new Uint8Array(await file.file.arrayBuffer());
    const profile = facade.getDefaultEepromProfile();
    await facade.programEeprom(profile, eepromOffset.value, buf);
    message.success("写入完成");
    log(`写入 EEPROM ${buf.length} bytes @ ${eepromOffset.value}`);
  } catch (e) {
    message.error(String(e));
    log(`写入失败: ${String(e)}`);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <n-space vertical size="large" style="padding: 16px; max-width: 960px; margin: 0 auto">
    <n-card title="Weblink Flash Kit">
      <n-space vertical size="medium">
        <n-space vertical :size="4">
          <n-text strong>编程器（转接芯片）</n-text>
          <n-select
            v-model:value="selectedAdapterId"
            style="max-width: 360px"
            :options="adapterSelectOptions"
            placeholder="选择编程器"
          />
        </n-space>
        <n-space vertical :size="4">
          <n-text strong>总线协议</n-text>
          <n-radio-group v-model:value="bus" size="medium">
            <n-radio-button
              value="spi"
              :disabled="!adapterSupportsBusInCells(matrixCells, selectedAdapterId, 'spi')"
            >
              SPI（NOR Flash）
            </n-radio-button>
            <n-radio-button
              value="i2c"
              :disabled="!adapterSupportsBusInCells(matrixCells, selectedAdapterId, 'i2c')"
            >
              I²C（串行 EEPROM）
            </n-radio-button>
          </n-radio-group>
        </n-space>
        <n-space align="center" :wrap="false">
          <n-button type="primary" :disabled="!canConnect() || busy" @click="onConnect">连接设备</n-button>
        </n-space>
        <n-text v-if="connectionHint" type="warning">{{ connectionHint }}</n-text>
      </n-space>
    </n-card>

    <n-card v-if="bus === 'spi'" title="SPI NOR">
      <n-space vertical>
        <n-space>
          <n-button :disabled="busy" @click="onIdentifyNor">识别 JEDEC</n-button>
          <n-select
            v-model:value="selectedNorId"
            style="min-width: 260px"
            :options="norOptions"
            placeholder="或手动选择型号"
            clearable
          />
        </n-space>
        <n-space align="center">
          <n-text>偏移</n-text>
          <n-input-number v-model:value="offset" :min="0" :step="1" />
          <n-text>长度</n-text>
          <n-input-number v-model:value="length" :min="1" :step="1" />
          <n-button :disabled="busy" @click="onReadNor">读取</n-button>
        </n-space>
        <n-divider />
        <n-text depth="3">编程（整文件写入前将擦除覆盖扇区）</n-text>
        <n-upload :default-upload="false" :max="1" @change="(o) => onProgramNor(o.fileList[0] ?? null)">
          <n-upload-dragger>
            <div>选择 .bin 并上传以编程</div>
          </n-upload-dragger>
        </n-upload>
      </n-space>
    </n-card>

    <n-card v-else title="I²C EEPROM (AT24C256 配置)">
      <n-space vertical>
        <n-space align="center">
          <n-text>偏移</n-text>
          <n-input-number v-model:value="eepromOffset" :min="0" :step="1" />
          <n-text>长度</n-text>
          <n-input-number v-model:value="eepromLength" :min="1" :step="1" />
          <n-button :disabled="busy" @click="onReadEeprom">读取</n-button>
        </n-space>
        <n-upload :default-upload="false" :max="1" @change="(o) => onProgramEeprom(o.fileList[0] ?? null)">
          <n-upload-dragger>
            <div>选择 .bin 写入 EEPROM</div>
          </n-upload-dragger>
        </n-upload>
      </n-space>
    </n-card>

    <FlashLogPanel :lines="logs" />
  </n-space>
</template>
