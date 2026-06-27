import { useRef, useEffect } from 'react'

interface ScreenViewerProps {
  stream: MediaStream | null
  label?: string
}

export default function ScreenViewer({ stream, label }: ScreenViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = videoRef.current
    if (el) {
      el.srcObject = stream
    }
    return () => {
      if (el) {
        el.srcObject = null
      }
    }
  }, [stream])

  if (!stream) {
    return (
      <div className="screen-viewer screen-viewer--empty">
        <p>等待加入</p>
      </div>
    )
  }

  return (
    <div className="screen-viewer">
      <video ref={videoRef} autoPlay playsInline muted className="screen-viewer__video" />
      {label && <span className="screen-viewer__label">{label}</span>}
    </div>
  )
}
