import { useEffect, useMemo, useRef, useState } from "react";
import { observer } from "@rabjs/react";
import { Container } from "@rabjs/service";
import { CounterService } from "../demos/counter/CounterService";

/**
 * 首页签名元素：Agent 终端 × 真实状态
 *
 * 左侧终端以打字机效果循环播放一段 MCP 风格的工具调用脚本；
 * 每条「调用」在打完的那一刻真实执行 CounterService 的方法，
 * 右侧 APP 面板是 observer 组件，读的是同一份响应式状态，
 * 数字随终端调用跳动 —— 「人和 AI 读写同一份状态」的现场演示。
 *
 * 实现要点：
 * - 独立 Container，不与页面里其他 CounterDemo 的容器互相影响；
 * - 尊重 prefers-reduced-motion：直接呈现完整脚本，不播放动画；
 * - count 不归零，循环之间状态延续（这也是卖点：状态一直在那里）。
 */

type TermLine = { kind: "call"; text: string; run?: () => void } | { kind: "result"; text: string | (() => string) };

export function SignalDemo() {
  const container = useMemo(() => {
    const c = new Container({ name: "hero-signal" });
    c.register(CounterService);
    return c;
  }, []);
  const service = useMemo(() => container.resolve(CounterService), [container]);

  const script = useMemo<TermLine[]>(
    () => [
      { kind: "call", text: `list_services({})` },
      { kind: "result", text: `← { services: ["${service.instanceId}"] }` },
      { kind: "call", text: `execute_action({ action: "increment" })`, run: () => service.increment() },
      { kind: "result", text: `← { ok: true }` },
      { kind: "call", text: `execute_action({ action: "increment" })`, run: () => service.increment() },
      { kind: "result", text: `← { ok: true }` },
      { kind: "call", text: `get_state({ instanceId: "${service.instanceId}" })` },
      // 函数形式：该行出现时才读取当前 count，保证与右侧 APP 面板一致
      { kind: "result", text: () => `← { count: ${service.count} }  # 与右侧始终是同一个值` },
    ],
    [service]
  );

  const [visible, setVisible] = useState<{ line: TermLine; typed: number }[]>([]);
  const [typing, setTyping] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      // 无动画：一次性呈现，并执行所有动作
      script.forEach((l) => l.kind === "call" && l.run?.());
      setVisible(script.map((line) => ({ line, typed: -1 })));
      return;
    }

    let lineIdx = 0;
    let charIdx = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const line = script[lineIdx];
      if (line.kind === "result") {
        const text = typeof line.text === "function" ? line.text() : line.text;
        setVisible((v) => [...v, { line: { kind: "result", text }, typed: -1 }]);
        lineIdx += 1;
        timerRef.current = setTimeout(tick, lineIdx === script.length ? 0 : 550);
        if (lineIdx === script.length) {
          // 播完一轮：停顿后清空重播（状态延续，不归零）
          timerRef.current = setTimeout(() => {
            if (cancelled) return;
            lineIdx = 0;
            charIdx = 0;
            setVisible([]);
            setTyping(false);
            tick();
          }, 4200);
        }
        return;
      }
      // call 行：逐字打
      setTyping(true);
      charIdx += 1;
      // 注意：必须先把值装进本帧的 const，再放进 updater ——
      // updater 在渲染时才执行，直接读 charIdx 会读到后续帧被重置的值
      const typedNow = charIdx;
      setVisible((v) => [...v.filter((e) => e.line !== line), { line, typed: typedNow }]);
      if (charIdx >= line.text.length) {
        line.run?.();
        // 完成：整行显示并去掉光标
        setVisible((v) => v.map((e) => (e.line === line ? { line, typed: -1 } : e)));
        lineIdx += 1;
        charIdx = 0;
        timerRef.current = setTimeout(tick, 380);
      } else {
        timerRef.current = setTimeout(tick, 34);
      }
    };

    timerRef.current = setTimeout(tick, 600);
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [script]);

  return (
    <div className="signal-demo">
      <div className="signal-pane">
        <div className="signal-pane-header agent">
          <span className="signal-dot agent" />
          AI Agent · MCP tools
        </div>
        <div className="terminal-lines">
          {visible.map(({ line, typed }, i) =>
            line.kind === "call" ? (
              <div key={i} className="t-call">
                <span className="t-prompt">› </span>
                {typed === -1 ? line.text : line.text.slice(0, typed)}
                {typed !== -1 && <span className="t-cursor" />}
              </div>
            ) : (
              <div key={i} className="t-result">
                {typeof line.text === "function" ? line.text() : line.text}
              </div>
            )
          )}
          {!typing && visible.length === 0 && <span className="t-cursor" />}
        </div>
      </div>
      <div className="signal-pane">
        <div className="signal-pane-header human">
          <span className="signal-dot human" />
          Your App · 同一份状态
        </div>
        <SignalAppView service={service} />
      </div>
    </div>
  );
}

/** APP 面板：observer 追踪同一个 CounterService 实例，终端调用即跳动 */
const SignalAppView = observer(({ service }: { service: CounterService }) => {
  const [bump, setBump] = useState(false);
  const prevRef = useRef(service.count);

  useEffect(() => {
    if (service.count !== prevRef.current) {
      prevRef.current = service.count;
      setBump(true);
      const t = setTimeout(() => setBump(false), 160);
      return () => clearTimeout(t);
    }
  }, [service.count]);

  return (
    <div className="signal-app">
      <span className="app-hint">count</span>
      <span className={`app-count${bump ? " bump" : ""}`}>{service.count}</span>
      <div className="demo-row">
        <button className="demo-btn" onClick={() => service.decrement()}>
          -1
        </button>
        <button className="demo-btn primary" onClick={() => service.increment()}>
          +1
        </button>
      </div>
      <span className="app-hint">人点按钮，AI 调工具，改的都是它</span>
    </div>
  );
});
