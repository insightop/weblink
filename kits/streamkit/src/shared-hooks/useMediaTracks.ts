import { useCallback, useMemo, useRef, useState } from "react";
import { captureMicrophone, captureCamera } from "../webrtc/mediaTrack";
import type { LocalMedia } from "../webrtc/mediaTrack";
import type { Session } from "../room/roomTypes";

export interface UseMediaTracksReturn {
  micOn: boolean;
  cameraOn: boolean;
  micError: string | null;
  cameraError: string | null;
  /** 切换麦克风。传入当前 session 以添加/移除轨道 */
  toggleMic: (session: Session | null) => Promise<void>;
  /** 切换摄像头。传入当前 session 以添加/移除轨道 */
  toggleCamera: (session: Session | null) => Promise<void>;
  /** 组件卸载时释放所有媒体资源 */
  cleanup: () => void;
}

/**
 * 管理麦克风和摄像头的媒体轨道生命周期。
 * 与 useSessionManager 独立，接收 session 参数而非直接耦合。
 */
export function useMediaTracks(): UseMediaTracksReturn {
  const [micOn, setMicOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const micSender = useRef<RTCRtpSender[]>([]);
  const micMedia = useRef<LocalMedia | null>(null);
  const cameraSender = useRef<RTCRtpSender[]>([]);
  const cameraMedia = useRef<LocalMedia | null>(null);

  const toggleMic = useCallback(async (session: Session | null) => {
    if (!session) return;

    if (micMedia.current) {
      // 关闭麦克风
      for (const sender of micSender.current) {
        session.removeTrack(sender);
      }
      micSender.current = [];
      micMedia.current.stop();
      micMedia.current = null;
      setMicOn(false);
      setMicError(null);
    } else {
      // 开启麦克风
      try {
        setMicError(null);
        const audio = await captureMicrophone();
        micMedia.current = audio;
        const senders: RTCRtpSender[] = [];
        for (const track of audio.stream.getTracks()) {
          senders.push(session.addTrack(track, audio.stream));
        }
        micSender.current = senders;
        setMicOn(true);
      } catch (err) {
        setMicError(err instanceof Error ? err.message : "麦克风访问失败");
      }
    }
  }, []);

  const toggleCamera = useCallback(async (session: Session | null) => {
    if (!session) return;

    if (cameraMedia.current) {
      // 关闭摄像头
      for (const sender of cameraSender.current) {
        session.removeTrack(sender);
      }
      cameraSender.current = [];
      cameraMedia.current.stop();
      cameraMedia.current = null;
      setCameraOn(false);
      setCameraError(null);
    } else {
      // 开启摄像头
      try {
        setCameraError(null);
        const video = await captureCamera();
        cameraMedia.current = video;
        const senders: RTCRtpSender[] = [];
        for (const track of video.stream.getTracks()) {
          senders.push(session.addTrack(track, video.stream));
        }
        cameraSender.current = senders;
        setCameraOn(true);
      } catch (err) {
        setCameraError(err instanceof Error ? err.message : "摄像头访问失败");
      }
    }
  }, []);

  const cleanup = useCallback(() => {
    micMedia.current?.stop();
    micMedia.current = null;
    micSender.current = [];
    cameraMedia.current?.stop();
    cameraMedia.current = null;
    cameraSender.current = [];
    setMicOn(false);
    setCameraOn(false);
    setMicError(null);
    setCameraError(null);
  }, []);

  return useMemo(() => ({ micOn, cameraOn, micError, cameraError, toggleMic, toggleCamera, cleanup }), [
    micOn,
    cameraOn,
    micError,
    cameraError,
    toggleMic,
    toggleCamera,
    cleanup,
  ]);
}
