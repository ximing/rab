import ObserverLogDemo from './ObserverLogDemo';

export default ObserverLogDemo;

/**
 * 与 live demo 对应的展示源码（DemoCard 的 code 属性使用）。
 * 内容约定：改动 ObserverLogDemo 时同步更新这里的字符串。
 */
export const observerLogDemoCode = `import { useEffect, useState } from "react";
import { observable, observe, unobserve } from "@rabjs/observer";

// 普通对象变成响应式对象，不经过 Service
const state = observable({ count: 0, text: "hello" });

export default function ObserverLogDemo() {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    // observe(fn)：fn 先同步执行一次，收集读取到的依赖；
    // 之后依赖每次变化都会重新触发 fn
    const reaction = observe(() => {
      setLogs((prev) => [
        ...prev,
        \`reaction 触发：count=\${state.count}, text=\${state.text}\`,
      ]);
    });
    // 卸载时释放依赖连接
    return () => unobserve(reaction);
  }, []);

  return (
    <button onClick={() => { state.count += 1; }}>count +1</button>
    // ...日志列表渲染 logs
  );
}
`;
