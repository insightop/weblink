export type LocalMedia = {
  stream: MediaStream;
  stop: () => void;
};

export async function captureUserMedia(audio: boolean, video: boolean): Promise<LocalMedia> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio, video });
  return {
    stream,
    stop: () => {
      for (const t of stream.getTracks()) t.stop();
    },
  };
}

export async function captureDisplayMedia(withAudio: boolean): Promise<LocalMedia> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: withAudio,
  });
  return {
    stream,
    stop: () => {
      for (const t of stream.getTracks()) t.stop();
    },
  };
}
