import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoom, joinRoom } from "../room/roomManager";
import type { Session, SessionOptions, SessionState } from "../room/roomTypes";
import type { EncodingStrategy } from "../signaling/messageTypes";

export interface UseSessionManagerOptions {
  signalingUrl: string;
  onRemoteStream?: (stream: MediaStream | null) => void;
  onCameraStream?: (stream: MediaStream | null) => void;
  onMicRequest?: () => void;
  onCameraRequest?: () => void;
  onPeerLeft?: () => void;
}

export interface UseSessionManagerReturn {
  state: SessionState;
  roomCode: string | null;
  error: string | null;
  strategy: EncodingStrategy;
  /** 获取当前 session 对象（始终返回最新值，供事件处理器中使用） */
  getSession: () => Session | null;
  startSharing: (screenStream: MediaStream) => Promise<void>;
  stopSharing: () => void;
  joinByCode: (code: string) => Promise<void>;
  endSession: () => void;
  addMediaTrack: (track: MediaStreamTrack, stream: MediaStream) => RTCRtpSender | undefined;
  removeMediaTrack: (sender: RTCRtpSender) => void;
  requestMic: () => void;
  requestCamera: () => void;
  setEncodingStrategy: (strategy: EncodingStrategy) => void;
}

/**
 * 管理 StreamKit 会话生命周期。
 * 提供 createRoom（demo 侧）和 joinRoom（admin 侧）两种会话模式，
 * 以及媒体轨道添加/移除、设备请求等辅助方法。
 */
export function useSessionManager(options: UseSessionManagerOptions): UseSessionManagerReturn {
  const { signalingUrl } = options;
  const [state, setState] = useState<SessionState>("disconnected");
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<EncodingStrategy>("auto");
  const sessionRef = useRef<Session | null>(null);

  // 用 ref 存储回调 props，避免事件处理器中的陈旧闭包
  const onRemoteStreamRef = useRef(options.onRemoteStream);
  onRemoteStreamRef.current = options.onRemoteStream;
  const onCameraStreamRef = useRef(options.onCameraStream);
  onCameraStreamRef.current = options.onCameraStream;
  const onMicRequestRef = useRef(options.onMicRequest);
  onMicRequestRef.current = options.onMicRequest;
  const onCameraRequestRef = useRef(options.onCameraRequest);
  onCameraRequestRef.current = options.onCameraRequest;
  const onPeerLeftRef = useRef(options.onPeerLeft);
  onPeerLeftRef.current = options.onPeerLeft;

  // 清理函数
  useEffect(() => {
    return () => {
      sessionRef.current?.dispose();
      sessionRef.current = null;
    };
  }, []);

  // ── 设置 session 事件监听 ──
  const setupSessionEvents = useCallback((sess: Session) => {
    sess.on("state-change", (s) => setState(s));
    sess.on("error", (err) => setError(err.message));
    sess.on("strategy-change", (s) => setStrategy(s));

    sess.on("remote-stream", () => {
      const streams = [...sess.remoteStreams.values()];
      onRemoteStreamRef.current?.(streams[0] ?? null);
    });

    sess.on("camera-stream", (stream) => {
      onCameraStreamRef.current?.(stream);
    });

    sess.on("mic-request", () => {
      onMicRequestRef.current?.();
    });

    sess.on("camera-request", () => {
      onCameraRequestRef.current?.();
    });

    sess.on("peer-left", () => {
      onPeerLeftRef.current?.();
    });
  }, []);

  // ── Demo 侧：开始共享 ──
  const startSharing = useCallback(async (screenStream: MediaStream) => {
    try {
      setError(null);
      setState("connecting");

      const sess = await createRoom({ signalingUrl });
      sessionRef.current = sess;
      setRoomCode(sess.roomId);
      setupSessionEvents(sess);

      for (const track of screenStream.getTracks()) {
        sess.addTrack(track, screenStream);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("disconnected");
    }
  }, [signalingUrl, setupSessionEvents]);

  // ── Demo 侧：停止共享（仅清理会话，媒体由 useMediaTracks 处理） ──
  const stopSharing = useCallback(() => {
    sessionRef.current?.dispose();
    sessionRef.current = null;
    setState("disconnected");
    setRoomCode(null);
    setStrategy("auto");
  }, []);

  // ── Admin 侧：通过分享码加入 ──
  const joinByCode = useCallback(async (code: string) => {
    try {
      setError(null);
      setState("connecting");

      const options: SessionOptions = { signalingUrl, roomId: code };
      const sess = await joinRoom(options);
      sessionRef.current = sess;
      setRoomCode(sess.roomId);
      setupSessionEvents(sess);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("disconnected");
    }
  }, [signalingUrl, setupSessionEvents]);

  // ── Admin 侧：结束会话 ──
  const endSession = useCallback(() => {
    onRemoteStreamRef.current?.(null);
    onCameraStreamRef.current?.(null);
    sessionRef.current?.dispose();
    sessionRef.current = null;
    setState("disconnected");
    setRoomCode(null);
    setStrategy("auto");
  }, []);

  // ── 媒体轨道管理 ──
  const addMediaTrack = useCallback((track: MediaStreamTrack, stream: MediaStream) => {
    return sessionRef.current?.addTrack(track, stream);
  }, []);

  const removeMediaTrack = useCallback((sender: RTCRtpSender) => {
    sessionRef.current?.removeTrack(sender);
  }, []);

  // ── Admin 设备请求 ──
  const requestMic = useCallback(() => {
    sessionRef.current?.requestMic();
  }, []);

  const requestCamera = useCallback(() => {
    sessionRef.current?.requestCamera();
  }, []);

  // ── 传输策略 ──
  const setEncodingStrategy = useCallback((s: EncodingStrategy) => {
    setStrategy(s);
    sessionRef.current?.setEncodingStrategy(s);
  }, []);

  return useMemo(() => ({
    state,
    roomCode,
    error,
    strategy,
    getSession: () => sessionRef.current,
    startSharing,
    stopSharing,
    joinByCode,
    endSession,
    addMediaTrack,
    removeMediaTrack,
    requestMic,
    requestCamera,
    setEncodingStrategy,
  }), [state, roomCode, error, strategy]);
}
