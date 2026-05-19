import { initMatrixRegistry, getBridge, assertBusSupported } from "@/matrix/registry";
import type { BridgeBackendId, BusKind } from "@/matrix/types";
import { FlashKitError, FlashKitErrorCode } from "@/domain/errors/FlashKitError";
import { SpiNorDriver } from "@/domain/spi/nor/SpiNorDriver";
import { matchNorProfile, listNorProfiles } from "@/domain/spi/nor/norProfileRegistry";
import type { SpiNorProfile } from "@/domain/spi/nor/SpiNorProfile";
import { winbondW25q32 } from "@/domain/spi/nor/profiles/winbondW25q32";
import { I2cEepromDriver } from "@/domain/i2c/eeprom/I2cEepromDriver";
import type { I2cEepromProfile } from "@/domain/i2c/eeprom/I2cEepromProfile";
import { at24c256 } from "@/domain/i2c/eeprom/profiles/at24c256";
import { WebUsbSession } from "@/infrastructure/usb/WebUsbSession";
import { WebHidSession } from "@/infrastructure/hid/WebHidSession";
import type { BridgeBackend } from "@/infrastructure/bridges/BridgeBackend";
import { allMatrixCells } from "@/matrix/presets/allMatrixCells";
import { flashKitLogger } from "@/shared/logging/flashKitLogger";

export interface FlashWorkbenchState {
  readonly deviceLabel: string | null;
  readonly bridgeId: BridgeBackendId | null;
  readonly bus: BusKind | null;
}

export class FlashWorkbenchFacade {
  private readonly usbSession = new WebUsbSession();
  private readonly hidSession = new WebHidSession();
  private bridge: BridgeBackend | null = null;
  private bridgeId: BridgeBackendId | null = null;
  private bus: BusKind | null = null;

  constructor() {
    initMatrixRegistry();
  }

  getState(): FlashWorkbenchState {
    const usb = this.usbSession.getDevice();
    const hid = this.hidSession.getDevice();
    return {
      deviceLabel: usb?.productName ?? hid?.productName ?? null,
      bridgeId: this.bridgeId,
      bus: this.bus,
    };
  }

  listMatrixCells() {
    return allMatrixCells;
  }

  async requestUsbDevice(filters: USBDeviceFilter[]): Promise<void> {
    this.hidSession.clearDevice();
    await this.usbSession.requestDevice(filters);
    const dev = this.usbSession.getDevice();
    flashKitLogger.info({ vid: dev?.vendorId, pid: dev?.productId, transport: "webusb" }, "USB device selected");
  }

  async requestHidDevice(filters: HIDDeviceFilter[]): Promise<void> {
    this.usbSession.clearDevice();
    await this.hidSession.requestDevice(filters);
    const dev = this.hidSession.getDevice();
    flashKitLogger.info({ vid: dev?.vendorId, pid: dev?.productId, transport: "webhid" }, "HID device selected");
  }

  async openBridge(bridgeId: BridgeBackendId, bus: BusKind): Promise<void> {
    assertBusSupported(bridgeId, bus);
    const entry = getBridge(bridgeId);
    if (!entry) {
      throw new FlashKitError(FlashKitErrorCode.BRIDGE_NOT_SUPPORTED, `Unknown bridge ${bridgeId}`);
    }
    await this.closeBridge();

    if (entry.transport === "webusb") {
      if (!this.usbSession.getDevice()) {
        throw new FlashKitError(FlashKitErrorCode.DEVICE_NOT_SELECTED, "No USB device selected");
      }
      this.bridge = entry.createUsb(this.usbSession);
    } else {
      if (!this.hidSession.getDevice()) {
        throw new FlashKitError(FlashKitErrorCode.DEVICE_NOT_SELECTED, "No HID device selected");
      }
      this.bridge = entry.createHid(this.hidSession);
    }
    this.bridgeId = bridgeId;
    this.bus = bus;
    await this.bridge.open();
    flashKitLogger.info({ bridgeId, bus, transport: entry.transport }, "Bridge opened");
  }

  async closeBridge(): Promise<void> {
    if (this.bridge) {
      await this.bridge.close();
      this.bridge = null;
      this.bridgeId = null;
      this.bus = null;
    }
  }

  listNorProfiles(): readonly SpiNorProfile[] {
    return listNorProfiles();
  }

  getDefaultEepromProfile(): I2cEepromProfile {
    return at24c256;
  }

  async identifySpiNor(): Promise<SpiNorProfile> {
    const b = this.requireBridge();
    const spi = b.getSpiPort();
    if (!spi) {
      throw new FlashKitError(FlashKitErrorCode.BUS_NOT_SUPPORTED, "SPI not available");
    }
    const probe = new SpiNorDriver(spi, winbondW25q32);
    const id = await probe.readJedecId();
    const matched = matchNorProfile(id.manufacturerId, id.deviceIdHigh, id.deviceIdLow);
    if (!matched) {
      throw new FlashKitError(
        FlashKitErrorCode.CHIP_MISMATCH,
        `Unknown JEDEC ${id.manufacturerId.toString(16)} ${id.deviceIdHigh.toString(16)} ${id.deviceIdLow.toString(16)}`,
      );
    }
    flashKitLogger.info({ jedec: matched.id }, "SPI NOR identified");
    return matched;
  }

  async readSpiNor(profile: SpiNorProfile, offset: number, length: number): Promise<Uint8Array> {
    const spi = this.requireBridge().getSpiPort();
    if (!spi) {
      throw new FlashKitError(FlashKitErrorCode.BUS_NOT_SUPPORTED, "SPI not available");
    }
    const drv = new SpiNorDriver(spi, profile);
    return await drv.readRange(offset, length);
  }

  async programSpiNor(profile: SpiNorProfile, offset: number, data: Uint8Array): Promise<void> {
    const spi = this.requireBridge().getSpiPort();
    if (!spi) {
      throw new FlashKitError(FlashKitErrorCode.BUS_NOT_SUPPORTED, "SPI not available");
    }
    const drv = new SpiNorDriver(spi, profile);
    const ss = profile.sectorSize;
    const startSector = Math.floor(offset / ss) * ss;
    const end = offset + data.length;
    for (let a = startSector; a < end; a += ss) {
      flashKitLogger.info({ sector: a }, "Erase sector");
      await drv.sectorErase(a);
    }
    await drv.programRange(offset, data);
  }

  async verifySpiNor(profile: SpiNorProfile, offset: number, expected: Uint8Array): Promise<void> {
    const spi = this.requireBridge().getSpiPort();
    if (!spi) {
      throw new FlashKitError(FlashKitErrorCode.BUS_NOT_SUPPORTED, "SPI not available");
    }
    const drv = new SpiNorDriver(spi, profile);
    await drv.verifyEqual(offset, expected);
  }

  async readEeprom(profile: I2cEepromProfile, offset: number, length: number): Promise<Uint8Array> {
    const i2c = this.requireBridge().getI2cPort();
    if (!i2c) {
      throw new FlashKitError(FlashKitErrorCode.BUS_NOT_SUPPORTED, "I2C not available");
    }
    const drv = new I2cEepromDriver(i2c, profile);
    return await drv.readRange(offset, length);
  }

  async programEeprom(profile: I2cEepromProfile, offset: number, data: Uint8Array): Promise<void> {
    const i2c = this.requireBridge().getI2cPort();
    if (!i2c) {
      throw new FlashKitError(FlashKitErrorCode.BUS_NOT_SUPPORTED, "I2C not available");
    }
    const drv = new I2cEepromDriver(i2c, profile);
    await drv.programRange(offset, data);
  }

  private requireBridge(): BridgeBackend {
    if (!this.bridge) {
      throw new FlashKitError(FlashKitErrorCode.DEVICE_NOT_SELECTED, "Bridge is not open");
    }
    return this.bridge;
  }
}
