import { computed, type Ref } from "vue";
import { createAudioContext } from "../../../infrastructure/audio/webAudioFacade";
import { logger } from "../../../infrastructure/logging/logger";

type AudioContextWithSink = AudioContext & {
  setSinkId?: (id: string) => Promise<void>;
};

export function supportsSetSinkId(): boolean {
  return (
    typeof HTMLMediaElement !== "undefined" &&
    "setSinkId" in HTMLMediaElement.prototype
  );
}

export function supportsAudioContextSetSink(ctx: AudioContext): boolean {
  return typeof (ctx as AudioContextWithSink).setSinkId === "function";
}

export function useAudioOutputDevices(devices: Ref<MediaDeviceInfo[]>) {
  const outputDevices = computed(() =>
    devices.value.filter((d) => d.kind === "audiooutput"),
  );
  return { outputDevices };
}

/** 在用户点击等手势内调用；向指定扬声器输出短促测试音 */
export async function playTestTone(
  sinkId: string | undefined,
  durationMs = 400,
  frequencyHz = 880,
): Promise<void> {
  const ctx = createAudioContext();
  try {
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    const ctxSink = ctx as AudioContextWithSink;
    if (sinkId && supportsAudioContextSetSink(ctx)) {
      await ctxSink.setSinkId!(sinkId);
    } else if (sinkId) {
      logger.warn("当前浏览器不支持 AudioContext.setSinkId，将使用默认输出设备");
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.12;
    osc.type = "sine";
    osc.frequency.value = frequencyHz;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        try {
          osc.stop();
        } catch {
          /* ignore */
        }
        void ctx.close().then(resolve).catch(resolve);
      }, durationMs);
    });
  } catch (e) {
    logger.error("playTestTone", e);
    await ctx.close().catch(() => {});
    throw e;
  }
}
