import { useState, useMemo } from "react";
import "./lab.css";

export function WebTransportLabPage() {
  const [url, setUrl] = useState("https://localhost:3000");
  const [connected, setConnected] = useState(false);

  const supported = useMemo(() => {
    return typeof window !== "undefined" && "WebTransport" in window;
  }, []);

  const handleConnect = async () => {
    // TODO: 实现 WebTransport 连接
    setConnected(true);
  };

  const handleDisconnect = () => {
    // TODO: 断开 WebTransport 连接
    setConnected(false);
  };

  return (
    <div className="wt-page">
      <header className="wt-topbar">
        <h1 className="wt-topbar__title">WebTransport Kit</h1>
        <div className="wt-topbar__meta">
          {!supported && (
            <span className="wt-topbar__warn">当前浏览器不支持 WebTransport</span>
          )}
          {supported && connected && (
            <span className="wt-topbar__ok">已连接</span>
          )}
          {supported && !connected && (
            <span className="wt-topbar__idle">待连接</span>
          )}
        </div>
      </header>

      <div className="wt-shell">
        <div className="wt-layout">
          {/* 连接面板 */}
          <section className="wt-section">
            <h2 className="wt-section__title">连接</h2>
            <div className="wt-section__body">
              <div className="wt-field">
                <label className="wt-field__label">服务器 URL</label>
                <input
                  className="wt-input"
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={connected}
                  placeholder="https://localhost:3000"
                />
              </div>
              <div className="wt-actions">
                {!connected ? (
                  <button
                    className="wt-btn wt-btn--primary"
                    onClick={handleConnect}
                    disabled={!supported}
                  >
                    连接
                  </button>
                ) : (
                  <button className="wt-btn wt-btn--danger" onClick={handleDisconnect}>
                    断开
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* 双向数据 */}
          <section className="wt-section">
            <h2 className="wt-section__title">双向流</h2>
            <div className="wt-section__body wt-section__body--muted">
              <p>WebTransport 双向流功能将在后续版本中实现。</p>
            </div>
          </section>

          {/* 单向数据 */}
          <section className="wt-section">
            <h2 className="wt-section__title">单向数据</h2>
            <div className="wt-section__body wt-section__body--muted">
              <p>WebTransport 单向数据功能将在后续版本中实现。</p>
            </div>
          </section>

          {/* 统计信息 */}
          <section className="wt-section">
            <h2 className="wt-section__title">统计</h2>
            <div className="wt-section__body wt-section__body--muted">
              <p>连接统计信息将在后续版本中展示。</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
