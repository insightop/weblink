export interface LocalMedia {
  stream: MediaStream;
  stop(): void;
}

/**
 * Capture the user's screen via getDisplayMedia.
 * Requests 1080p@24fps ideal, no audio.
 */
export async function captureScreen(): Promise<LocalMedia> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 24, max: 30 },
    },
    audio: false,
    // @ts-expect-error — CHIP: selfBrowserSurface is Chrome-only, not in all TS lib types
    selfBrowserSurface: "include",
  });

  return {
    stream,
    stop: () => {
      for (const track of stream.getTracks()) track.stop();
    },
  };
}

/**
 * Capture the user's microphone via getUserMedia.
 * Requests audio with echo cancellation, noise suppression, and auto gain control.
 */
export async function captureMicrophone(): Promise<LocalMedia> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  });

  return {
    stream,
    stop: () => {
      for (const track of stream.getTracks()) track.stop();
    },
  };
}

/**
 * Capture the user's camera via getUserMedia.
 * Requests 720p video.
 */
export async function captureCamera(): Promise<LocalMedia> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 24, max: 30 },
    },
    audio: false,
  });

  return {
    stream,
    stop: () => {
      for (const track of stream.getTracks()) track.stop();
    },
  };
}
