import { useCallback, useEffect, useRef, useState } from "react";
import { captureScreen } from "../webrtc/mediaTrack";
import type { LocalMedia } from "../webrtc/mediaTrack";
import type { EncodingStrategy } from "../signaling/messageTypes";
import { useSessionManager } from "../shared-hooks/useSessionManager";
import { useMediaTracks } from "../shared-hooks/useMediaTracks";
import "./control-bar.css";

interface TopControlBarProps {
  mode: "demo" | "admin";
  signalingUrl: string;
  onRemoteStream?: (stream: MediaStream | null) => void;
  onCameraStream?: (stream: MediaStream | null) => void;
  /** 外部提供的屏幕流（StreamKitPlugin 用）。设置后将跳过 captureScreen 调用 */
  initialScreenStream?: MediaStream | null;
  /** 会话结束时回调（StreamKitPlugin 用） */
  onDisconnected?: () => void;
}

const STATE_LABELS: Record<string, string> = {
  disconnected: "未连接",
  connecting: "连接中...",
  connected: "已连接",
  error: "连接失败",
};

const STRATEGY_LABELS: Record<EncodingStrategy, string> = {
  auto: "自动",
  speed: "速度",
  quality: "清晰度",
};

/**
 * 统一控制栏组件，供 demo 和 admin 两种模式使用。
 *
 * demo 模式：显示"开始共享屏幕"按钮 → 分享码 → 操作面板
 * admin 模式：显示分享码输入 → 加入按钮 → 远程控制面板
 *
 * 消除旧 RoomControlBar 中的陈旧闭包 ref 模式，改用 hooks 分离职责：
 * - useSessionManager：会话生命周期
 * - useMediaTracks：麦克风/摄像头轨道管理
 */
export function TopControlBar({ mode, signalingUrl, onRemoteStream, onCameraStream, initialScreenStream, onDisconnected }: TopControlBarProps) {
  const [codeInput, setCodeInput] = useState("");
  const screenMediaRef = useRef<LocalMedia | null>(null);

  // S1：先调用所有 hooks
  const mediaTracks = useMediaTracks();

  // S2：用 ref 包装需要实时同步的值
  const getSessionRef = useRef<() => ReturnType<typeof sessionManager.getSession>>(() => null);
  const peerLeftRef = useRef<() => void>(() => {});
  const onDisconnectedRef = useRef<() => void>(() => {});
  onDisconnectedRef.current = onDisconnected ?? (() => {});
  const micOnRef = useRef(mediaTracks.micOn);
  micOnRef.current = mediaTracks.micOn;
  const cameraOnRef = useRef(mediaTracks.cameraOn);
  cameraOnRef.current = mediaTracks.cameraOn;
  const toggleMicRef = useRef(mediaTracks.toggleMic);
  toggleMicRef.current = mediaTracks.toggleMic;
  const toggleCameraRef = useRef(mediaTracks.toggleCamera);
  toggleCameraRef.current = mediaTracks.toggleCamera;

  // S3：创建 sessionManager（模式切换只影响初始注册，不会动态改变）
  const sessionManager = useSessionManager({
    signalingUrl,
    onRemoteStream,
    onCameraStream,
    onMicRequest: mode === "demo"
      ? () => {
          if (micOnRef.current) return;
          if (confirm("管理员请求开启麦克风，是否允许？")) {
            toggleMicRef.current(getSessionRef.current());
          }
        }
      : undefined,
    onCameraRequest: mode === "demo"
      ? () => {
          if (cameraOnRef.current) return;
          if (confirm("管理员请求开启摄像头，是否允许？")) {
            toggleCameraRef.current(getSessionRef.current());
          }
        }
      : undefined,
    onPeerLeft: () => peerLeftRef.current(),
  });

  // S4：同步 session 访问器和 peer-left 处理器
  getSessionRef.current = sessionManager.getSession;

  // ── 解构当前渲染值 ──
  const { state, roomCode, error, strategy } = sessionManager;
  const { micOn, cameraOn } = mediaTracks;

  // ── Demo 端：开始共享 ──
  const startSharing = useCallback(async () => {
    try {
      const media = initialScreenStream
        ? { stream: initialScreenStream, stop: () => initialScreenStream.getTracks().forEach((t) => t.stop()) }
        : await captureScreen();
      screenMediaRef.current = media;
      await sessionManager.startSharing(media.stream);
    } catch {
      // 用户取消 getDisplayMedia 或捕获失败，不额外处理
    }
  }, [sessionManager, initialScreenStream]);

  // ── Demo 端：停止共享 ──
  const stopSharing = useCallback(() => {
    screenMediaRef.current?.stop();
    screenMediaRef.current = null;
    sessionManager.stopSharing();
    mediaTracks.cleanup();
    onDisconnectedRef.current();
  }, [sessionManager, mediaTracks]);

  // ── Admin 端：结束会话 ──
  const endSession = useCallback(() => {
    sessionManager.endSession();
    onDisconnectedRef.current();
  }, [sessionManager]);

  // ── 同步 peer-left 处理器 ──
  peerLeftRef.current = mode === "demo" ? stopSharing : endSession;

  // ── 初始自动开始共享（StreamKitPlugin 用） ──
  // 仅在挂载时触发一次。initialScreenStream 在插件场景下生命周期与组件一致，无需响应变化。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (initialScreenStream && mode === "demo" && state === "disconnected") {
      startSharing();
    }
  }, []);

  // ── 清理 ──
  // 所有依赖为 ref 引用，React 无法静态追踪其变化。screenMediaRef / mediaTracks 在卸载时直接调用 stop/cleanup。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    return () => {
      screenMediaRef.current?.stop();
      screenMediaRef.current = null;
      mediaTracks.cleanup();
    };
  }, []);

  // ── 派生状态 ──
  const isWaiting = state === "connecting" && roomCode !== null;
  const isConnected = state === "connected";
  const showCode = roomCode !== null && state !== "disconnected";
  const showMic = roomCode !== null && (isWaiting || isConnected);

  return (
    <div className="control-bar">
      {/* ── Demo: 开始共享 ── */}
      {mode === "demo" && state === "disconnected" && (
        <button className="control-bar__btn control-bar__btn--primary" onClick={startSharing}>
          开始共享屏幕
        </button>
      )}

      {/* ── Admin: 输入分享码 ── */}
      {mode === "admin" && state === "disconnected" && (
        <>
          <input
            className="control-bar__input"
            type="text"
            placeholder="8 位分享码"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, "").slice(0, 8))}
            maxLength={8}
          />
          <button
            className="control-bar__btn control-bar__btn--primary"
            onClick={() => sessionManager.joinByCode(codeInput)}
            disabled={codeInput.length !== 8}
          >
            加入
          </button>
        </>
      )}

      {/* ── Admin: 连接中（正在 joinRoom） ── */}
      {mode === "admin" && state === "connecting" && roomCode === null && (
        <span className="control-bar__state control-bar__state--connecting">连接中...</span>
      )}

      {/* ── 显示房间码和状态 ── */}
      {showCode && (
        <>
          <span className="control-bar__code">{roomCode}</span>
          <span
            className={`control-bar__state ${
              isConnected ? "control-bar__state--connected" : isWaiting ? "control-bar__state--connecting" : ""
            }`}
          >
            {isWaiting
              ? mode === "demo" ? "等待运维人员加入..." : "连接中..."
              : STATE_LABELS[state] ?? state}
          </span>
        </>
      )}

      {/* ── Admin: 传输策略 ── */}
      {mode === "admin" && showCode && (
        <div className="control-bar__strategy">
          {(["auto", "speed", "quality"] as const).map((s) => (
            <button
              key={s}
              className={`control-bar__strategy-btn ${strategy === s ? "control-bar__strategy-btn--active" : ""}`}
              onClick={() => sessionManager.setEncodingStrategy(s)}
            >
              {STRATEGY_LABELS[s]}
            </button>
          ))}
        </div>
      )}

      {/* ── Admin: 请求远端设备 ── */}
      {mode === "admin" && isConnected && (
        <>
          <button
            className="control-bar__btn"
            onClick={() => sessionManager.requestMic()}
            title="请求开启麦克风"
          >
            <MicSvg />
          </button>
          <button
            className="control-bar__btn"
            onClick={() => sessionManager.requestCamera()}
            title="请求开启摄像头"
          >
            <CameraSvg />
          </button>
        </>
      )}

      {/* ── 麦克风开关 ── */}
      {showMic && (
        <button
          className={`control-bar__btn ${micOn ? "control-bar__btn--active" : ""}`}
          onClick={() => mediaTracks.toggleMic(sessionManager.getSession())}
          title={micOn ? "关闭麦克风" : "开启麦克风"}
        >
          {micOn ? <MicSvg /> : <MicOffSvg />}
        </button>
      )}

      {/* ── 摄像头开关（仅 Demo） ── */}
      {mode === "demo" && showMic && (
        <button
          className={`control-bar__btn ${cameraOn ? "control-bar__btn--active" : ""}`}
          onClick={() => mediaTracks.toggleCamera(sessionManager.getSession())}
          title={cameraOn ? "关闭摄像头" : "开启摄像头"}
        >
          {cameraOn ? <CameraSvg /> : <CameraOffSvg />}
        </button>
      )}

      {/* ── Demo: 结束共享 ── */}
      {mode === "demo" && showCode && (
        <button className="control-bar__btn control-bar__btn--danger" onClick={stopSharing}>
          <StopSvg />
          结束共享
        </button>
      )}

      {/* ── Admin: 停止观看 ── */}
      {mode === "admin" && showCode && (
        <button className="control-bar__btn control-bar__btn--danger" onClick={endSession}>
          <EyeOffSvg />
          停止观看
        </button>
      )}

      {/* ── 错误信息 ── */}
      {error && <span className="control-bar__error">{error}</span>}
    </div>
  );
}

// ── SVG icon 组件 ──

function MicSvg() {
  return (
    <svg className="control-bar__btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="11" rx="3" ry="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="23" />
    </svg>
  );
}

function MicOffSvg() {
  return (
    <svg className="control-bar__btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="11" rx="3" ry="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function CameraSvg() {
  return (
    <svg className="control-bar__btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function CameraOffSvg() {
  return (
    <svg className="control-bar__btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function StopSvg() {
  return (
    <svg className="control-bar__btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <line x1="8" y1="10" x2="16" y2="16" />
      <line x1="16" y1="10" x2="8" y2="16" />
    </svg>
  );
}

function EyeOffSvg() {
  return (
    <svg className="control-bar__btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
