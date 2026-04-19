import { onUnmounted, ref, shallowRef } from "vue";
import { getUserMedia } from "@/infrastructure/media/mediaDevicesFacade";
import { createAudioContext } from "@/infrastructure/audio/webAudioFacade";
import { mapMediaError } from "@/domain/media/errors";
import { rmsFromTimeDomain, rmsToLevel, smoothLevel } from "@/domain/media/levelMath";

/** 时域快照长度；越大则波形「时间窗」越长（约 sampleRate / fftSize 秒量级 @48kHz：8192≈170ms，16384≈341ms） */
const FFT_SIZE = 32768;

export function useMicLevelMeter() {
  const stream = shallowRef<MediaStream | null>(null);
  const level = ref(0);
  const error = ref<string | null>(null);
  const running = ref(false);
  /** 与电平同源的时间域缓冲，供波形绘制；停止时为 null */
  const waveformData = shallowRef<Float32Array | null>(null);

  let audioContext: AudioContext | null = null;
  let rafId = 0;
  const dataBuf = new Float32Array(FFT_SIZE);
  let smoothed = 0;

  async function start(audioDeviceId?: string): Promise<void> {
    await stop();
    error.value = null;
    try {
      const audio: boolean | MediaTrackConstraints = audioDeviceId
        ? { deviceId: { exact: audioDeviceId } }
        : true;
      stream.value = await getUserMedia({ video: false, audio });
      audioContext = createAudioContext();
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }
      const source = audioContext.createMediaStreamSource(stream.value);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      source.connect(analyser);

      waveformData.value = dataBuf;

      const loop = (): void => {
        analyser.getFloatTimeDomainData(dataBuf);
        const rms = rmsFromTimeDomain(dataBuf);
        const raw = rmsToLevel(rms);
        smoothed = smoothLevel(smoothed, raw);
        level.value = smoothed;
        rafId = requestAnimationFrame(loop);
      };
      loop();
      running.value = true;
    } catch (e) {
      error.value = mapMediaError(e);
      running.value = false;
      waveformData.value = null;
      dataBuf.fill(0);
    }
  }

  async function stop(): Promise<void> {
    cancelAnimationFrame(rafId);
    rafId = 0;
    stream.value?.getTracks().forEach((t) => t.stop());
    stream.value = null;
    smoothed = 0;
    level.value = 0;
    running.value = false;
    waveformData.value = null;
    dataBuf.fill(0);
    if (audioContext) {
      await audioContext.close().catch(() => {});
      audioContext = null;
    }
  }

  onUnmounted(() => {
    void stop();
  });

  return { stream, level, error, running, waveformData, start, stop };
}
