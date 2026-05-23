import { toUserError, UserError } from "../errors/userErrors";

export type BluetoothStatus =
  | { state: "idle" }
  | { state: "device_selected"; name: string }
  | { state: "connecting"; name: string }
  | { state: "connected"; name: string }
  | { state: "disconnected"; name: string };

export type CharacteristicId = {
  serviceUuid: BluetoothServiceUUID;
  characteristicUuid: BluetoothCharacteristicUUID;
};

export class BluetoothSession {
  device: BluetoothDevice | null = null;
  server: BluetoothRemoteGATTServer | null = null;

  private subscriptions = new Map<string, (ev: Event) => void>();

  async requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice> {
    try {
      const bluetooth = navigator.bluetooth;
      const device = await bluetooth.requestDevice(options ?? { acceptAllDevices: true });
      this.device = device;
      return device;
    } catch (e) {
      throw toUserError(e);
    }
  }

  async connect(): Promise<BluetoothRemoteGATTServer> {
    const device = this.device;
    if (!device) throw new UserError("invalid_state", "请先选择设备");
    if (!device.gatt) throw new UserError("unsupported", "当前设备不支持 GATT");

    try {
      const server = await device.gatt.connect();
      this.server = server;
      return server;
    } catch (e) {
      throw toUserError(e);
    }
  }

  async disconnect(): Promise<void> {
    try {
      for (const [key, handler] of this.subscriptions) {
        const [svc, chr] = key.split("|");
        if (!svc || !chr) continue;
        // best-effort unsubscribe
        try {
          const c = await this.getCharacteristic(svc, chr);
          c.removeEventListener("characteristicvaluechanged", handler);
        } catch {
          // ignore
        }
      }
      this.subscriptions.clear();

      if (this.device?.gatt?.connected) this.device.gatt.disconnect();
      this.server = null;
    } catch (e) {
      throw toUserError(e);
    }
  }

  async listServices(): Promise<BluetoothRemoteGATTService[]> {
    if (!this.server) throw new UserError("invalid_state", "未连接");
    try {
      return await this.server.getPrimaryServices();
    } catch (e) {
      throw toUserError(e);
    }
  }

  async listCharacteristics(serviceUuid: BluetoothServiceUUID): Promise<BluetoothRemoteGATTCharacteristic[]> {
    try {
      const svc = await this.getService(serviceUuid);
      return await svc.getCharacteristics();
    } catch (e) {
      throw toUserError(e);
    }
  }

  async readValue(id: CharacteristicId): Promise<DataView> {
    try {
      const c = await this.getCharacteristic(id.serviceUuid, id.characteristicUuid);
      const v = await c.readValue();
      return v;
    } catch (e) {
      throw toUserError(e);
    }
  }

  async writeValue(id: CharacteristicId, data: BufferSource): Promise<void> {
    try {
      const c = await this.getCharacteristic(id.serviceUuid, id.characteristicUuid);
      if (typeof c.writeValueWithoutResponse === "function") {
        await c.writeValueWithoutResponse(data);
        return;
      }
      await c.writeValue(data);
    } catch (e) {
      throw toUserError(e);
    }
  }

  async subscribe(
    id: CharacteristicId,
    onValue: (value: DataView) => void,
  ): Promise<() => Promise<void>> {
    try {
      const c = await this.getCharacteristic(id.serviceUuid, id.characteristicUuid);
      await c.startNotifications();

      const key = `${String(id.serviceUuid)}|${String(id.characteristicUuid)}`;
      const handler = (ev: Event) => {
        const target = ev.target as BluetoothRemoteGATTCharacteristic | null;
        if (!target?.value) return;
        onValue(target.value);
      };
      this.subscriptions.set(key, handler);
      c.addEventListener("characteristicvaluechanged", handler);

      return async () => {
        const h = this.subscriptions.get(key);
        if (h) {
          c.removeEventListener("characteristicvaluechanged", h);
          this.subscriptions.delete(key);
        }
        try {
          await c.stopNotifications();
        } catch {
          // ignore
        }
      };
    } catch (e) {
      throw toUserError(e);
    }
  }

  private async getService(serviceUuid: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService> {
    if (!this.server) throw new UserError("invalid_state", "未连接");
    return await this.server.getPrimaryService(serviceUuid);
  }

  private async getCharacteristic(
    serviceUuid: BluetoothServiceUUID,
    characteristicUuid: BluetoothCharacteristicUUID,
  ): Promise<BluetoothRemoteGATTCharacteristic> {
    const svc = await this.getService(serviceUuid);
    return await svc.getCharacteristic(characteristicUuid);
  }
}

