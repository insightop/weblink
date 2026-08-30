/**
 * ProgressView — 居中进度视图：spinner + 文案。
 * 文案由调用方传入已翻译字符串（connecting / provisioning 复用同一视图），
 * 组件自身不取词、保持单一职责。
 */
export function ProgressView({ label }: { label: string }) {
  return (
    <div className="improv-progress" role="status">
      <span className="improv-progress__spinner" aria-hidden="true" />
      <p className="improv-progress__label">{label}</p>
    </div>
  )
}
