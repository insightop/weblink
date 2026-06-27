import { useState, useEffect } from "react";

function BigClock() {
  const [time, setTime] = useState(new Date());
  const [dateStr, setDateStr] = useState("");

  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      setTime(now);
      setDateStr(
        now.toLocaleDateString("zh-CN", {
          year: "numeric",
          month: "long",
          day: "numeric",
          weekday: "long",
        }),
      );
    }, 1000);
    const now = new Date();
    setDateStr(
      now.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
      }),
    );
    return () => clearInterval(id);
  }, []);

  return (
    <div className="dc-big-clock">
      <span className="dc-big-clock__date">{dateStr}</span>
      <span className="dc-big-clock__time">
        {time.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </span>
    </div>
  );
}

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <div className="dc-widget__counter">
      <span className="dc-counter__value">{count}</span>
      <div className="dc-counter__buttons">
        <button className="dc-btn" onClick={() => setCount((c) => c - 1)}>-</button>
        <button className="dc-btn dc-btn--primary" onClick={() => setCount((c) => c + 1)}>+</button>
        <button className="dc-btn" onClick={() => setCount(0)}>重置</button>
      </div>
    </div>
  );
}

function TextPreview() {
  const [text, setText] = useState("");

  return (
    <div className="dc-widget__text-preview">
      <input
        className="dc-input"
        type="text"
        placeholder="输入一些文字..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {text && <p className="dc-preview">预览: {text}</p>}
    </div>
  );
}

/**
 * Interactive demo page content — a minimal starter-style dashboard.
 */
export default function DemoContent() {
  return (
    <div className="demo-page">
      <div className="demo-page__hero">
        <h1 className="demo-page__title">StreamKit Demo</h1>
      </div>

      {/* Large clock in main area */}
      <BigClock />

      <div className="demo-page__widgets">
        <div className="dc-card">
          <h3 className="dc-card__title">计数器</h3>
          <Counter />
        </div>

        <div className="dc-card">
          <h3 className="dc-card__title">文字预览</h3>
          <TextPreview />
        </div>
      </div>
    </div>
  );
}
