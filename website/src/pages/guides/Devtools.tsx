import { Link } from "react-router-dom";
import { CodeBlock } from "../../components/CodeBlock";
import { DemoCard } from "../../components/DemoCard";
import DevtoolsDemo, { devtoolsDemoCode } from "../../demos/devtools";

const installCode = `pnpm add @rabjs/devtools`;

const setupCode = `// 应用入口文件（main.ts / index.ts）调用一次
import { setupWindowRootContainer } from "@rabjs/devtools";

setupWindowRootContainer();`;

const consoleCode = `// 之后就能在浏览器控制台里随时查看容器树：

// 列出整棵容器树中所有已实例化的 Service（返回的是内存对象，可直接操作）
window.__RS_ROOT_CONTAINER__.listServices()
// => [{ instanceId, containerName, identifierLabel, instance }, ...]

// 按 instanceId 拿到某个 Service 实例，直接读状态、调方法
const svc = window.__RS_ROOT_CONTAINER__.getService("CounterService#0");
svc.count;            // 读状态
svc.increment();      // 页面会实时响应

// 按容器名拿容器，进一步翻它的子容器和注册表
window.__RS_ROOT_CONTAINER__.getContainer("Counter_1")?.getChildren();

// 链式断言：适合 E2E / 冒烟脚本
window.__RS_ROOT_CONTAINER__
  .expect("CounterService#0")
  .toBe("count", 1)
  .check();`;

/**
 * DevTools 调试（路由 /guides/devtools）
 */
export default function Devtools() {
  return (
    <div>
      <h1>DevTools 调试</h1>
      <p>
        <code>@rabjs/devtools</code> 把容器树的访问入口挂到{" "}
        <code>window.__RS_ROOT_CONTAINER__</code>，让你（或 AI、E2E 脚本）在
        React 组件树之外直接查看和操作 Service 实例。
      </p>

      <h2>接入</h2>
      <CodeBlock language="bash">{installCode}</CodeBlock>
      <p>
        只需要一行初始化。它与框架无关，SSR 环境会自动跳过；以全局容器为根，
        所有 <code>bindServices</code> 创建的子容器都在它的遍历范围内：
      </p>
      <CodeBlock language="ts" title="main.ts">{setupCode}</CodeBlock>

      <h2>能做什么</h2>
      <CodeBlock language="ts">{consoleCode}</CodeBlock>
      <p>
        <code>listServices()</code> 返回的是真实的内存对象，控制台里改属性、调方法，
        页面上的 <code>observer</code> 组件会照常响应——这也是它和「状态快照」类工具的区别。
      </p>

      <h2>在本页直接试</h2>
      <p>
        这个站点本身已经接好了 <code>setupWindowRootContainer()</code>。先去{" "}
        <Link to="/guides/demos">在线 Demo</Link> 点几下让 Service 实例化，
        再回来点下面的按钮（当然，也可以直接按 F12 在控制台里玩）：
      </p>
      <DemoCard
        title="列出容器树中的 Service"
        description="window.__RS_ROOT_CONTAINER__.listServices() 的实时结果"
        code={devtoolsDemoCode}
      >
        <DevtoolsDemo />
      </DemoCard>

      <h2>和 AI 调试的联动</h2>
      <p>
        这个 window 入口同时是 AI 调试的桥梁：rab-cdp-debug Skill 通过 CDP 协议在
        真实浏览器里执行同样的调用，让 AI 直接读状态、调方法、跑断言。详见{" "}
        <Link to="/ai/skill-cdp-debug">rab-cdp-debug Skill</Link>。
      </p>
    </div>
  );
}
