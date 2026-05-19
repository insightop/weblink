/**
 * HubertD/cangaroo 风格表（jxltom/gs_usb），sample point ~87.5%。
 * 返回 struct gs_device_bittiming 五字段（LE 打包由 transport 负责）。
 */
export function bitrateToDeviceBittiming(
  bitrate: number,
  fclkCan: number,
):
  | { propSeg: number; phaseSeg1: number; phaseSeg2: number; sjw: number; brp: number }
  | null {
  const propSeg = 1;
  const phaseSeg1 = 12;
  const phaseSeg2 = 2;
  const sjw = 1;

  if (fclkCan === 48_000_000) {
    const brp = TABLE_48M[bitrate];
    if (brp == null) return null;
    return { propSeg, phaseSeg1, phaseSeg2, sjw, brp };
  }
  if (fclkCan === 80_000_000) {
    if (bitrate === 800_000) {
      return { propSeg, phaseSeg1: 7, phaseSeg2: 1, sjw, brp: 10 };
    }
    const brp = TABLE_80M[bitrate];
    if (brp == null) return null;
    return { propSeg, phaseSeg1, phaseSeg2, sjw, brp };
  }
  return null;
}

const TABLE_48M: Record<number, number> = {
  10000: 300,
  20000: 150,
  50000: 60,
  83333: 36,
  100000: 30,
  125000: 24,
  250000: 12,
  500000: 6,
  800000: 4,
  1000000: 3,
};

const TABLE_80M: Record<number, number> = {
  10000: 500,
  20000: 250,
  50000: 100,
  83333: 60,
  100000: 50,
  125000: 40,
  250000: 20,
  500000: 10,
  800000: 10,
  1000000: 5,
};

export function packDeviceBittiming(t: {
  propSeg: number;
  phaseSeg1: number;
  phaseSeg2: number;
  sjw: number;
  brp: number;
}): ArrayBuffer {
  const buf = new ArrayBuffer(20);
  const v = new DataView(buf);
  v.setUint32(0, t.propSeg, true);
  v.setUint32(4, t.phaseSeg1, true);
  v.setUint32(8, t.phaseSeg2, true);
  v.setUint32(12, t.sjw, true);
  v.setUint32(16, t.brp, true);
  return buf;
}

export function packDeviceMode(mode: number, flags: number): ArrayBuffer {
  const buf = new ArrayBuffer(8);
  const v = new DataView(buf);
  v.setUint32(0, mode, true);
  v.setUint32(4, flags, true);
  return buf;
}
