import { Link } from "react-router-dom";
import { CodeBlock } from "../../components/CodeBlock";
import { DemoCard } from "../../components/DemoCard";
import CounterDemo, { counterDemoCode } from "../../demos/counter";

const installCode = `pnpm add @rabjs/react @rabjs/service
# @rabjs/observer 会被一起装上，一般不需要直接操作`;

const step1Code = `import { Service } from "@rabjs/react";

// 继承 Service：属性自动响应式，方法自动是 Action
export class CounterService extends Service {
  count = 0;

  increment() {
    this.count += 1;
  }
}`;

const step2Code = `import { observer, useService } from "@rabjs/react";
import { CounterService } from "./CounterService";

const Counter = observer(() => {
  const counter = useService(CounterService);
  return (
    <button onClick={() => counter.increment()}>
      {counter.count}
    </button>
  );
});`;

const step3Code = `import { bindServices } from "@rabjs/react";

// bindServices 为组件创建一个服务容器并注册这些 Service，
// 组件树内 useService 拿到的就是这个容器里的实例
export default bindServices(Counter, [CounterService]);`;

/**
 * 快速开始（路由 /quick-start，属于传统用法板块）
 * 目标：让第一次接触的人 5 分钟跑起来一个响应式计数器。
 */
export default function QuickStart() {
  return (
    <div>
      <h1>快速开始</h1>
      <p>
        从 0 到 1 跑通 RAB 的最小链路：安装 → 三段式写法 → 一个可交互的完整示例。
      </p>

      <h2>安装</h2>
      <CodeBlock language="bash">{installCode}</CodeBlock>
      <p>
        <code>@rabjs/react</code> 内部重新导出了 <code>@rabjs/service</code> 和{" "}
        <code>@rabjs/observer</code> 的全部 API，日常开发只从{" "}
        <code>@rabjs/react</code> 一个入口 import 即可。
      </p>

      <h2>三段式写法</h2>
      <p>RAB 的所有用法都是这三步，记住它就够了：</p>

      <h3>1. 定义 Service</h3>
      <p>
        状态和业务方法都放进一个继承 <code>Service</code> 的类里。不需要写
        reducer、action type 或任何模板代码：
      </p>
      <CodeBlock language="ts" title="CounterService.ts">{step1Code}</CodeBlock>

      <h3>2. observer + useService</h3>
      <p>
        用 <code>observer</code> 包装组件（这样它才会追踪响应式依赖），{" "}
        <code>useService</code> 取出服务实例，然后像普通对象一样读写：
      </p>
      <CodeBlock language="tsx" title="Counter.tsx">{step2Code}</CodeBlock>

      <h3>3. bindServices 提供容器</h3>
      <p>
        服务实例由容器创建和管理。<code>bindServices</code> 在组件外面包一层容器，
        并把 Service 注册进去：
      </p>
      <CodeBlock language="tsx" title="index.ts">{step3Code}</CodeBlock>

      <h2>完整示例（可交互）</h2>
      <DemoCard
        title="计数器"
        description="就是上面三步拼起来的完整代码，点击按钮试试"
        code={counterDemoCode}
      >
        <CounterDemo />
      </DemoCard>

      <h2>常见疑问</h2>

      <h3>为什么属性一改，UI 就自动更新？</h3>
      <p>
        <code>Service</code> 的构造函数会把实例传给 <code>@rabjs/observer</code> 的{" "}
        <code>observable()</code>，返回一个响应式代理。<code>observer</code>{" "}
        组件渲染时读取了哪些属性会被记录下来，这些属性变化时组件自动重渲染——
        读多少追踪多少，没读到的字段变化不会触发。
      </p>

      <h3>方法需要手动加 @Action 吗？</h3>
      <p>
        不需要。<code>Service</code> 里所有方法默认就是 Action（修改会被批量合并，
        避免一次方法调用触发多次渲染）。想让某个方法跳出批量更新，才需要显式标{" "}
        <code>@SyncAction</code>。示例里写 <code>@Action</code> 只是为了可读性。
      </p>

      <h3>异步方法的 loading / error 从哪来？</h3>
      <p>
        基类为每个方法自动维护{" "}
        <code>{"$model.<方法名> = { loading, error }"}</code>：异步方法调用时{" "}
        <code>loading</code> 立即变 <code>true</code>，结束后复位；reject 的错误会写入{" "}
        <code>error</code>。<code>$model</code> 本身也是响应式的，可以直接渲染。
        完整例子见 <Link to="/guides/demos">在线 Demo 的异步加载</Link>。
      </p>

      <h3>不写 bindServices 会怎样？</h3>
      <p>
        非严格模式下，<code>useService</code> 遇到没注册的服务会自动注册到全局容器，
        所以不写也能跑。但 <code>bindServices</code> 给你的是独立作用域：
        同一个 Service 类在两个页面各有一份实例、互不影响，组件卸载时容器也随之销毁。
      </p>

      <h3>需要手动配置批处理吗？</h3>
      <p>
        不需要。<code>@rabjs/react</code> 被 import 时会自动把全局 scheduler 配成
        React 的 <code>unstable_batchedUpdates</code>（见包的 batch 模块）。
        只有脱离 React 单独用 <code>@rabjs/observer</code> 时才可能要用{" "}
        <code>configure()</code>。
      </p>

      <h2>下一步</h2>
      <ul>
        <li>
          <Link to="/guides/demos">在线 Demo</Link>：todo、异步加载、服务协作等更多可运行示例
        </li>
        <li>
          <Link to="/guides/service">Service 服务容器</Link>：服务间依赖（this.resolve）、Container、生命周期
        </li>
        <li>
          <Link to="/guides/observer">Observer 观察者</Link>：脱离 React 的响应式 API
        </li>
        <li>
          <Link to="/guides/devtools">DevTools 调试</Link>：在控制台查看和操作容器树
        </li>
      </ul>
    </div>
  );
}
