import { CodeBlock } from "../../components/CodeBlock";
import { DemoCard } from "../../components/DemoCard";
import ObserverLogDemo, { observerLogDemoCode } from "../../demos/observer-log";

const observableCode = `import { observable, observe, unobserve } from "@rabjs/observer";

// 1. observable：把普通对象变成响应式代理（深层：嵌套对象/数组也会被包装）
const state = observable({ count: 0, user: { name: "Alice" } });

// 2. observe：注册一个 reaction，先同步执行一次并收集读到的依赖
const reaction = observe(() => {
  console.log("count =", state.count);
});

state.count += 1;        // 依赖变化 -> reaction 重新执行，打印 count = 1
state.user.name = "Bob"; // 不触发：reaction 没读过 user.name

// 3. unobserve：释放依赖连接，之后变化不再触发
unobserve(reaction);`;

const shadowCode = `import { shadowObservable } from "@rabjs/observer";

// shadowObservable：浅层响应式，只追踪根级别属性的替换
const state = shadowObservable({ user: { name: "Alice" }, count: 0 });

state.count++;                 // 触发
state.user = { name: "Bob" };  // 触发（根属性替换）
state.user.name = "Bob";       // 不触发（嵌套对象不是 observable）

// 适用场景：大对象/第三方实例不需要深层追踪时，避免深层 Proxy 的开销`;

const observeOptionsCode = `import { observe } from "@rabjs/observer";

observe(fn, {
  lazy: true,        // 不立即执行，第一次手动调用 reaction() 时才收集依赖
  scheduler: (r) => queueMicrotask(r), // 自定义调度；默认无 scheduler，同步触发
  debugger: (op) => console.log(op),   // 每次触发时收到操作信息（类型/对象/键）
});`;

const utilsCode = `import { configure, isObservable, raw } from "@rabjs/observer";

isObservable(state);  // 是否是 observable 代理
raw(state);           // 取回代理背后的原始对象
configure({ scheduler });        // 改全局默认调度
// resetGlobalConfig()           // 恢复默认`;

/**
 * Observer 独立用法（路由 /guides/observer）
 */
export default function ObserverPage() {
  return (
    <div>
      <h1>Observer 观察者</h1>
      <p>
        <code>@rabjs/observer</code> 是底层的响应式引擎，完全不依赖 React：
        两个概念就够——<code>observable</code> 让对象可追踪，<code>observe</code>{" "}
        订阅变化。
      </p>

      <h2>observable + observe</h2>
      <CodeBlock language="ts">{observableCode}</CodeBlock>
      <p>
        reaction 收集依赖是「读什么追踪什么」：只有执行过程中真正读取过的属性
        变化时才会重新触发，没读到的字段随便改都不会惊动它。
      </p>

      <h2>shadowObservable：浅层版本</h2>
      <CodeBlock language="ts">{shadowCode}</CodeBlock>

      <h2>observe 的选项</h2>
      <CodeBlock language="ts">{observeOptionsCode}</CodeBlock>

      <h2>配置与工具函数</h2>
      <CodeBlock language="ts">{utilsCode}</CodeBlock>

      <h2>动手试试</h2>
      <p>
        下面的 demo 没用 Service、也没用 <code>observer</code> 组件：
        一个模块级的 <code>observable</code> 对象，按钮直接改它，{" "}
        <code>observe</code> 的回调把每次触发记成日志（日志本身是 React state，
        只负责展示）。
      </p>
      <DemoCard
        title="纯 observer 的响应式日志"
        description="observable + observe + unobserve，脱离 Service 与 React 集成"
        code={observerLogDemoCode}
      >
        <ObserverLogDemo />
      </DemoCard>

      <h2>和 @rabjs/react 的关系</h2>
      <p>
        <code>@rabjs/react</code> 就是在这一层之上做的绑定：<code>observer</code> /{" "}
        <code>view</code> / <code>useObserver</code> 内部都是把组件渲染函数包进一个{" "}
        <code>observe</code> reaction，再把它接到 React 的强制更新上；<code>Service</code>{" "}
        基类的响应式也是调用这里的 <code>observable()</code>。
        所以在 React 项目里你通常不需要直接碰这个包——它重新导出了全部 API，
        直接从 <code>@rabjs/react</code> import 也是一样的。
      </p>
    </div>
  );
}
