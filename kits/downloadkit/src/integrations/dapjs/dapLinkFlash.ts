/**
 * 浏览器侧 DAPLink 烧录（npm `dapjs`）。
 * 与官方示例一致：WebUSB + DAPLink.connect / flash / disconnect。
 */
import { DAPLink, WebUSB } from "dapjs";

export type DapLinkProgressHandler = (ratio: number) => void;

function toArrayBuffer(image: Uint8Array): ArrayBuffer {
  if (image.byteOffset === 0 && image.byteLength === image.buffer.byteLength) {
    return image.buffer as ArrayBuffer;
  }
  return image.slice().buffer;
}

/**
 * 对已通过 WebUSB 打开的 `USBDevice` 执行 DAPLink 流式烧录。
 * 成功或失败后均会尝试 `disconnect()`（内部会 `transport.close()` / `device.close()`）。
 */
export async function flashWithDapLink(
  usbDevice: USBDevice,
  image: Uint8Array,
  onProgress?: DapLinkProgressHandler,
): Promise<void> {
  const transport = new WebUSB(usbDevice);
  const target = new DAPLink(transport);
  if (onProgress) {
    target.on(DAPLink.EVENT_PROGRESS, onProgress);
  }
  try {
    await target.connect();
    await target.flash(toArrayBuffer(image));
    await target.disconnect();
  } catch (cause) {
    try {
      await target.disconnect();
    } catch {
      /* ignore secondary errors */
    }
    throw cause;
  } finally {
    target.removeAllListeners();
  }
}
