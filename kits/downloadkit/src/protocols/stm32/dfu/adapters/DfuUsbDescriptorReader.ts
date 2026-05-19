export interface InterfaceNameMap {
  [configurationValue: number]: {
    [interfaceNumber: number]: {
      [alternateSetting: number]: string | null;
    };
  };
}

const GET_DESCRIPTOR = 0x06;
const DT_CONFIGURATION = 0x02;
const DT_STRING = 0x03;
const DT_INTERFACE = 0x04;

interface InterfaceDescriptorShape {
  bInterfaceNumber: number;
  bAlternateSetting: number;
  iInterface: number;
}

function readUint16Le(data: DataView, offset: number): number {
  return data.getUint16(offset, true);
}

function parseInterfaceDescriptors(data: DataView): InterfaceDescriptorShape[] {
  const items: InterfaceDescriptorShape[] = [];
  let offset = 9; // skip configuration descriptor header
  while (offset + 1 < data.byteLength) {
    const bLength = data.getUint8(offset);
    const bDescriptorType = data.getUint8(offset + 1);
    if (bLength < 2 || offset + bLength > data.byteLength) break;
    if (bDescriptorType === DT_INTERFACE && bLength >= 9) {
      items.push({
        bInterfaceNumber: data.getUint8(offset + 2),
        bAlternateSetting: data.getUint8(offset + 3),
        iInterface: data.getUint8(offset + 8),
      });
    }
    offset += bLength;
  }
  return items;
}

async function readConfigurationDescriptor(device: USBDevice, configIndex: number): Promise<DataView> {
  const header = await device.controlTransferIn(
    {
      requestType: "standard",
      recipient: "device",
      request: GET_DESCRIPTOR,
      value: (DT_CONFIGURATION << 8) | configIndex,
      index: 0,
    },
    4,
  );
  if (header.status !== "ok" || !header.data) {
    throw new Error(`Failed to read configuration descriptor header: ${header.status}`);
  }
  const totalLength = readUint16Le(header.data, 2);
  const full = await device.controlTransferIn(
    {
      requestType: "standard",
      recipient: "device",
      request: GET_DESCRIPTOR,
      value: (DT_CONFIGURATION << 8) | configIndex,
      index: 0,
    },
    totalLength,
  );
  if (full.status !== "ok" || !full.data) {
    throw new Error(`Failed to read configuration descriptor body: ${full.status}`);
  }
  return full.data;
}

async function readStringDescriptor(device: USBDevice, index: number, langId = 0x0409): Promise<string | null> {
  if (index <= 0) return null;
  const header = await device.controlTransferIn(
    {
      requestType: "standard",
      recipient: "device",
      request: GET_DESCRIPTOR,
      value: (DT_STRING << 8) | index,
      index: langId,
    },
    2,
  );
  if (header.status !== "ok" || !header.data) return null;
  const len = header.data.getUint8(0);
  if (len < 2) return null;
  const full = await device.controlTransferIn(
    {
      requestType: "standard",
      recipient: "device",
      request: GET_DESCRIPTOR,
      value: (DT_STRING << 8) | index,
      index: langId,
    },
    len,
  );
  if (full.status !== "ok" || !full.data) return null;
  const chars: number[] = [];
  for (let i = 2; i + 1 < len; i += 2) {
    chars.push(full.data.getUint16(i, true));
  }
  return String.fromCharCode(...chars);
}

export async function readInterfaceNameMap(device: USBDevice): Promise<InterfaceNameMap> {
  const mapping: InterfaceNameMap = {};
  for (let configIndex = 0; configIndex < device.configurations.length; configIndex += 1) {
    const descriptor = await readConfigurationDescriptor(device, configIndex);
    const configValue = descriptor.getUint8(5);
    if (!mapping[configValue]) mapping[configValue] = {};
    const interfaces = parseInterfaceDescriptors(descriptor);
    for (const intf of interfaces) {
      if (!mapping[configValue][intf.bInterfaceNumber]) {
        mapping[configValue][intf.bInterfaceNumber] = {};
      }
      mapping[configValue][intf.bInterfaceNumber][intf.bAlternateSetting] = await readStringDescriptor(
        device,
        intf.iInterface,
      );
    }
  }
  return mapping;
}
