/**
 * 浏览器 MediaDevices 薄封装，便于测试时 mock。
 */
export async function enumerateDevices(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    throw new Error("当前环境不支持 navigator.mediaDevices.enumerateDevices");
  }
  return navigator.mediaDevices.enumerateDevices();
}

export async function getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("当前环境不支持 getUserMedia（需 HTTPS 或 localhost）");
  }
  return navigator.mediaDevices.getUserMedia(constraints);
}

export function onDeviceChange(handler: () => void): () => void {
  navigator.mediaDevices?.addEventListener("devicechange", handler);
  return () => navigator.mediaDevices?.removeEventListener("devicechange", handler);
}

/** 触发一次摄像头权限弹窗并立即释放流，便于随后 enumerate 拿到 label。 */
export async function primeVideoPermission(): Promise<void> {
  const stream = await getUserMedia({ video: true, audio: false });
  stream.getTracks().forEach((t) => t.stop());
}

/** 触发一次麦克风权限弹窗并立即释放流，便于随后 enumerate 拿到 label。 */
export async function primeAudioPermission(): Promise<void> {
  const stream = await getUserMedia({ video: false, audio: true });
  stream.getTracks().forEach((t) => t.stop());
}
