import { useState, useCallback } from "react";
import { captureScreen } from "../webrtc/mediaTrack";
import { TopControlBar } from "../components/TopControlBar";
import "./plugin.css";

interface StreamKitPluginProps {
  /** 信令服务器 URL */
  signalingUrl: string;
}

/**
 * 外部项目无痛集成组件。
 *
 * 只需在 React 应用中声明一处引用，页面即可自动获得共享屏幕的能力：
 *
 * ```tsx
 * import { StreamKitPlugin } from "@weblink/streamkit";
 *
 * function App() {
 *   return (
 *     <div>
 *       <StreamKitPlugin signalingUrl="wss://..." />
 *       <div>页面内容...</div>
 *     </div>
 *   );
 * }
 * ```
 *
 * 功能：
 * - 空闲时：页面右下角显示悬浮 "+" 按钮
 * - 点击后：自动调用 getDisplayMedia，建立 WebRTC 会话，显示顶栏控制
 * - 共享中：顶栏显示分享码、麦克风/摄像头开关、结束共享按钮
 * - 管理员断开或手动结束：回到悬浮按钮状态
 */
export function StreamKitPlugin({ signalingUrl }: StreamKitPluginProps) {
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  const handleFabClick = useCallback(async () => {
    try {
      const media = await captureScreen();
      setScreenStream(media.stream);
    } catch {
      // 用户取消了 getDisplayMedia，不做额外处理
    }
  }, []);

  const handleDisconnected = useCallback(() => {
    setScreenStream(null);
  }, []);

  // 空闲状态：显示悬浮按钮
  if (!screenStream) {
    return (
      <button className="streamkit-fab" onClick={handleFabClick} title="共享此页面">
        <FabIcon />
      </button>
    );
  }

  // 共享中：显示顶栏控制条
  return (
    <TopControlBar
      mode="demo"
      signalingUrl={signalingUrl}
      initialScreenStream={screenStream}
      onDisconnected={handleDisconnected}
    />
  );
}

function FabIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <polyline points="9 9 15 9 15 11" />
      <polyline points="15 9 10 14" />
    </svg>
  );
}
