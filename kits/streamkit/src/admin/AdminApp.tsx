import { useRef, useEffect, useState, useCallback } from "react";
import { TopControlBar } from "../components/TopControlBar";
import ScreenViewer from "./components/ScreenViewer";
import "./styles/admin.css";
import "../components/control-bar.css";

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL ?? "";

export default function AdminApp() {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const pipPosRef = useRef({ x: 0, y: 0 });
  const [pipPos, setPipPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    dragging: boolean;
  }>({ startX: 0, startY: 0, offsetX: 0, offsetY: 0, dragging: false });
  // 存储拖拽事件清理函数，防止组件卸载时监听器泄露
  const cleanupDragRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  // 组件卸载时清理可能残留的拖拽事件监听器
  useEffect(() => {
    return () => cleanupDragRef.current();
  }, []);

  const onPipMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    cleanupDragRef.current();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      offsetX: pipPosRef.current.x,
      offsetY: pipPosRef.current.y,
      dragging: true,
    };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current.dragging) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      const nx = dragRef.current.offsetX + dx;
      const ny = dragRef.current.offsetY + dy;
      pipPosRef.current = { x: nx, y: ny };
      setPipPos({ x: nx, y: ny });
    };

    const onUp = () => {
      dragRef.current.dragging = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    cleanupDragRef.current = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  return (
    <div className="admin-app">
      <TopControlBar
        mode="admin"
        signalingUrl={SIGNALING_URL || window.location.origin}
        onRemoteStream={setRemoteStream}
        onCameraStream={setCameraStream}
      />
      <div className="admin-app__viewer" style={{ paddingTop: 44, width: "100%", height: "100%", boxSizing: "border-box" as const }}>
        <ScreenViewer stream={remoteStream} />
        {cameraStream && (
          <div
            className="camera-pip"
            style={{ transform: `translate(${pipPos.x}px, ${pipPos.y}px)` }}
            onMouseDown={onPipMouseDown}
          >
            <div className="camera-pip__header">摄像头</div>
            <video ref={cameraVideoRef} autoPlay playsInline muted className="camera-pip__video" />
          </div>
        )}
      </div>
    </div>
  );
}
