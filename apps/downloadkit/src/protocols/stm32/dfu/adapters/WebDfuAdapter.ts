import {
  hydrateMissingInterfaceNames,
  getSegmentForAddress,
  listDfuInterfaces,
  parseDfuseMemoryDescriptor,
  pickBestDfuInterface,
} from "@/protocols/stm32/dfu/adapters/DfuInterfaceSelector";
import {
  DFU_REQUEST,
  DFU_STATE,
  DFU_STATUS_OK,
  DFUSE_COMMAND,
  type DfuInterfaceInfo,
  type DfuStatus,
  type DfuseDownloadOptions,
  type DfuseMemoryDescriptor,
} from "@/protocols/stm32/dfu/types/dfu.types";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isExpectedManifestDisconnectError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes("device unavailable") ||
    normalized.includes("device was disconnected") ||
    normalized.includes("notfounderror") ||
    normalized.includes("networkerror") ||
    normalized.includes("transfer error")
  );
}

export class WebDfuAdapter {
  private device: USBDevice | null = null;
  private selected: DfuInterfaceInfo | null = null;
  private memory: DfuseMemoryDescriptor | null = null;

  get chipName(): string {
    const d = this.device;
    if (!d) return "STM32-DFU";
    return d.productName ?? `STM32-DFU ${d.vendorId.toString(16)}:${d.productId.toString(16)}`;
  }

  get interfaceInfo(): DfuInterfaceInfo | null {
    return this.selected;
  }

  async connect(device: USBDevice): Promise<void> {
    this.device = device;

    if (!device.opened) {
      await device.open();
    }

    let interfaces = listDfuInterfaces(device);
    interfaces = await hydrateMissingInterfaceNames(device, interfaces).catch(() => interfaces);
    const selected = pickBestDfuInterface(interfaces);
    if (!selected) {
      throw new Error("No DFU interface found on selected USB device");
    }
    if (selected.interfaceProtocol === 0x01) {
      throw new Error("Device is in DFU runtime mode. Please reboot device into DFU mode.");
    }

    if (!device.configuration || device.configuration.configurationValue !== selected.configurationValue) {
      await device.selectConfiguration(selected.configurationValue);
    }

    await device.claimInterface(selected.interfaceNumber);
    await device.selectAlternateInterface(selected.interfaceNumber, selected.alternateSetting);

    this.selected = selected;
    if (selected.interfaceName) {
      try {
        this.memory = parseDfuseMemoryDescriptor(selected.interfaceName);
      } catch {
        this.memory = null;
      }
    }
    if (!this.memory) {
      const summary = interfaces
        .map(
          (item) =>
            `cfg=${item.configurationValue},intf=${item.interfaceNumber},alt=${item.alternateSetting},name=${item.interfaceName ?? "null"}`,
        )
        .join(" | ");
      throw new Error(`DfuSe memory map is unavailable: ${summary}`);
    }
  }

  async syncToIdle(): Promise<void> {
    const state = await this.getState();
    if (state === DFU_STATE.DFU_ERROR) {
      await this.clearStatus();
      await this.pollUntil((s) => s.state === DFU_STATE.DFU_IDLE || s.state === DFU_STATE.DFU_DNLOAD_IDLE);
      return;
    }
    if (state === DFU_STATE.DFU_DNLOAD_IDLE || state === DFU_STATE.DFU_UPLOAD_IDLE) {
      await this.abort();
      await this.pollUntil((s) => s.state === DFU_STATE.DFU_IDLE);
    }
  }

  async eraseAndWrite(options: DfuseDownloadOptions): Promise<void> {
    if (!this.memory || this.memory.segments.length === 0) {
      throw new Error("DfuSe memory map is unavailable");
    }

    await this.erase(options.startAddress, options.data.byteLength, options.onProgress);
    await this.writeData(options.startAddress, options.data, options.transferSize, options.onProgress);
    await this.manifest(options.startAddress);
  }

  async resetAndDetach(): Promise<void> {
    if (!this.device || !this.selected) return;
    await this.abort().catch(() => undefined);
    await this.device.releaseInterface(this.selected.interfaceNumber).catch(() => undefined);
    await this.device.close().catch(() => undefined);
    this.device = null;
    this.selected = null;
    this.memory = null;
  }

  private ensure(): { device: USBDevice; selected: DfuInterfaceInfo } {
    if (!this.device || !this.selected) {
      throw new Error("DFU adapter is not connected");
    }
    return { device: this.device, selected: this.selected };
  }

  private async download(payload: ArrayBuffer | Uint8Array, blockNum: number): Promise<number> {
    const { device, selected } = this.ensure();
    const data = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
    const result = await device.controlTransferOut(
      {
        requestType: "class",
        recipient: "interface",
        request: DFU_REQUEST.DNLOAD,
        value: blockNum,
        index: selected.interfaceNumber,
      },
      data,
    );
    if (result.status !== "ok") {
      throw new Error(`DNLOAD failed: ${result.status}`);
    }
    return data.byteLength;
  }

  private async getStatus(): Promise<DfuStatus> {
    const { device, selected } = this.ensure();
    const result = await device.controlTransferIn(
      {
        requestType: "class",
        recipient: "interface",
        request: DFU_REQUEST.GETSTATUS,
        value: 0,
        index: selected.interfaceNumber,
      },
      6,
    );
    if (result.status !== "ok" || !result.data) {
      throw new Error(`GETSTATUS failed: ${result.status}`);
    }
    const view = result.data;
    return {
      status: view.getUint8(0),
      pollTimeout: view.getUint8(1) | (view.getUint8(2) << 8) | (view.getUint8(3) << 16),
      state: view.getUint8(4),
      iString: view.getUint8(5),
    };
  }

  private async getState(): Promise<number> {
    const { device, selected } = this.ensure();
    const result = await device.controlTransferIn(
      {
        requestType: "class",
        recipient: "interface",
        request: DFU_REQUEST.GETSTATE,
        value: 0,
        index: selected.interfaceNumber,
      },
      1,
    );
    if (result.status !== "ok" || !result.data) {
      throw new Error(`GETSTATE failed: ${result.status}`);
    }
    return result.data.getUint8(0);
  }

  private async clearStatus(): Promise<void> {
    const { device, selected } = this.ensure();
    const result = await device.controlTransferOut({
      requestType: "class",
      recipient: "interface",
      request: DFU_REQUEST.CLRSTATUS,
      value: 0,
      index: selected.interfaceNumber,
    });
    if (result.status !== "ok") {
      throw new Error(`CLRSTATUS failed: ${result.status}`);
    }
  }

  private async abort(): Promise<void> {
    const { device, selected } = this.ensure();
    const result = await device.controlTransferOut({
      requestType: "class",
      recipient: "interface",
      request: DFU_REQUEST.ABORT,
      value: 0,
      index: selected.interfaceNumber,
    });
    if (result.status !== "ok") {
      throw new Error(`ABORT failed: ${result.status}`);
    }
  }

  private async pollUntil(predicate: (status: DfuStatus) => boolean): Promise<DfuStatus> {
    for (let i = 0; i < 300; i += 1) {
      const status = await this.getStatus();
      if (status.pollTimeout > 0) {
        await sleep(Math.min(status.pollTimeout, 1000));
      }
      if (predicate(status)) return status;
    }
    throw new Error("DFU state polling timed out");
  }

  private async dfuseCommand(command: number, param: number): Promise<void> {
    const payload = new ArrayBuffer(5);
    const view = new DataView(payload);
    view.setUint8(0, command);
    view.setUint32(1, param, true);

    await this.download(payload, 0);
    const status = await this.pollUntil((s) => s.state !== DFU_STATE.DFU_DNBUSY);
    if (status.status !== DFU_STATUS_OK) {
      throw new Error(`DfuSe command failed: cmd=0x${command.toString(16)} status=${status.status}`);
    }
  }

  private getSectorStart(address: number): number {
    if (!this.memory) throw new Error("No memory map");
    const segment = getSegmentForAddress(this.memory, address);
    if (!segment) throw new Error(`Address 0x${address.toString(16)} out of DfuSe memory range`);
    const sectorIndex = Math.floor((address - segment.start) / segment.sectorSize);
    return segment.start + sectorIndex * segment.sectorSize;
  }

  private getSectorEnd(address: number): number {
    if (!this.memory) throw new Error("No memory map");
    const segment = getSegmentForAddress(this.memory, address);
    if (!segment) throw new Error(`Address 0x${address.toString(16)} out of DfuSe memory range`);
    const sectorIndex = Math.floor((address - segment.start) / segment.sectorSize);
    return segment.start + (sectorIndex + 1) * segment.sectorSize;
  }

  private async erase(
    startAddress: number,
    length: number,
    onProgress: (written: number, total: number) => void,
  ): Promise<void> {
    let addr = this.getSectorStart(startAddress);
    const endAddr = this.getSectorEnd(startAddress + Math.max(0, length - 1));
    const bytesToErase = Math.max(0, endAddr - addr);
    let erased = 0;
    onProgress(0, length);

    while (addr < endAddr) {
      if (!this.memory) throw new Error("No memory map");
      const segment = getSegmentForAddress(this.memory, addr);
      if (!segment) throw new Error(`No segment for address 0x${addr.toString(16)}`);
      if (!segment.erasable) {
        const skip = Math.min(segment.end - addr, endAddr - addr);
        addr += skip;
        erased += skip;
        continue;
      }

      const sectorStart = this.getSectorStart(addr);
      await this.dfuseCommand(DFUSE_COMMAND.ERASE_SECTOR, sectorStart);
      const sectorEnd = this.getSectorEnd(addr);
      erased += Math.min(sectorEnd - sectorStart, endAddr - sectorStart);
      addr = sectorEnd;
      const erasePercent = bytesToErase > 0 ? Math.floor((erased / bytesToErase) * 10) : 0;
      onProgress(Math.min(Math.floor((erasePercent / 10) * length), Math.max(0, length - 1)), length);
    }
  }

  private async writeData(
    startAddress: number,
    data: Uint8Array,
    transferSize: number,
    onProgress: (written: number, total: number) => void,
  ): Promise<void> {
    let address = startAddress;
    let written = 0;
    const total = data.byteLength;

    while (written < total) {
      const chunkSize = Math.min(transferSize, total - written);
      const chunk = data.slice(written, written + chunkSize);
      await this.dfuseCommand(DFUSE_COMMAND.SET_ADDRESS, address);
      await this.download(chunk, 2);
      const status = await this.pollUntil((s) => s.state === DFU_STATE.DFU_DNLOAD_IDLE);
      if (status.status !== DFU_STATUS_OK) {
        throw new Error(`DFU download failed: state=${status.state} status=${status.status}`);
      }
      written += chunk.byteLength;
      address += chunk.byteLength;
      onProgress(written, total);
    }
  }

  private async manifest(startAddress: number): Promise<void> {
    try {
      await this.dfuseCommand(DFUSE_COMMAND.SET_ADDRESS, startAddress);
      await this.download(new ArrayBuffer(0), 0);
    } catch (error) {
      // Some ROM DFU implementations disconnect immediately after accepting the final manifest command.
      if (!isExpectedManifestDisconnectError(error)) {
        throw error;
      }
      return;
    }

    await this.pollUntil(
      (s) => s.state === DFU_STATE.DFU_MANIFEST || s.state === DFU_STATE.DFU_MANIFEST_WAIT_RESET,
    ).catch(() => undefined);
  }
}
