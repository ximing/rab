import { useEffect, useState } from "react";
import { observable, observe, unobserve } from "@rabjs/observer";

/**
 * Observer 独立用法 live demo —— 不经过 Service，也不经过 React state。
 *
 * state 是一个普通的 observable 对象；observe 包裹的函数是 reaction：
 * - 注册时先同步执行一次，收集读取到的依赖（count、text）；
 * - 之后任何依赖变化都会重新触发 reaction；
 * - 组件卸载时 unobserve 释放依赖连接，不再触发。
 */
const state = observable({ count: 0, text: "hello" });

export default function ObserverLogDemo() {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const reaction = observe(() => {
      setLogs((prev) => [
        ...prev,
        `reaction 触发：count=${state.count}, text=${state.text}`,
      ]);
    });
    return () => unobserve(reaction);
  }, []);

  return (
    <div>
      <div className="demo-row">
        <button
          className="demo-btn primary"
          onClick={() => {
            state.count += 1;
          }}
        >
          count +1
        </button>
        <button
          className="demo-btn"
          onClick={() => {
            state.text = state.text === "hello" ? "rab" : "hello";
          }}
        >
          切换 text
        </button>
        <button className="demo-btn" onClick={() => setLogs([])}>
          清空日志
        </button>
      </div>
      <p style={{ color: "var(--text-dim)", marginTop: 12 }}>
        当前值：count={state.count}, text={state.text}
        （这行不是 observer 组件，不会自动刷新，看日志即可）
      </p>
      <ul style={{ margin: "12px 0 0", paddingLeft: 20, color: "var(--text-dim)" }}>
        {logs.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
