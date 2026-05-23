import { onUnmounted, ref, shallowRef, watch, type Ref } from "vue";
import { getUserMedia } from "../../../infrastructure/media/mediaDevicesFacade";
import { mapMediaError } from "../../../domain/media/errors";

export function useCameraStream(videoRef: Ref<HTMLVideoElement | null>) {
  const stream = shallowRef<MediaStream | null>(null);
  const error = ref<string | null>(null);
  const running = ref(false);

  watch(
    [stream, videoRef],
    ([s]) => {
      const el = videoRef.value;
      if (el) {
        el.srcObject = s;
        void el.play().catch(() => {});
      }
    },
    { flush: "post" },
  );

  async function start(videoDeviceId?: string): Promise<void> {
    await stop();
    error.value = null;
    try {
      const video: boolean | MediaTrackConstraints = videoDeviceId
        ? { deviceId: { exact: videoDeviceId } }
        : true;
      stream.value = await getUserMedia({ video, audio: false });
      running.value = true;
      await videoRef.value?.play().catch(() => {});
    } catch (e) {
      error.value = mapMediaError(e);
      running.value = false;
    }
  }

  async function stop(): Promise<void> {
    stream.value?.getTracks().forEach((t) => t.stop());
    stream.value = null;
    running.value = false;
    if (videoRef.value) videoRef.value.srcObject = null;
  }

  onUnmounted(() => {
    void stop();
  });

  return { stream, error, running, start, stop };
}
