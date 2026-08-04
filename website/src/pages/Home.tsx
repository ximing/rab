import { Link } from "react-router-dom";
import { CodeBlock } from "../components/CodeBlock";
import { DemoCard } from "../components/DemoCard";
import CounterDemo, { counterDemoCode } from "../demos/counter";

const installCode = `pnpm add @rabjs/service @rabjs/react
# 可选：调试工具 / AI 桥接
pnpm add @rabjs/devtools @rabjs/web-mcp`;

export default function Home() {
  return (
    <div className="hero">
      <h1>RAB</h1>
      <p className="tagline">
        响应式状态管理方案：<code>@rabjs/service</code> 服务容器 +{" "}
        <code>@rabjs/observer</code> 观察者 + <code>@rabjs/react</code> React
        集成 + <code>@rabjs/devtools</code> 调试 + <code>@rabjs/web-mcp</code>{" "}
        AI 桥接。让状态以「服务」为单位组织，让人和 AI 都能读写它。
      </p>

      <h2>安装</h2>
      <CodeBlock language="bash">{installCode}</CodeBlock>

      <h2>最小示例</h2>
      <p>
        一个可运行的计数器：定义 Service，用 <code>observer</code> 包装组件，{" "}
        <code>bindServices</code> 提供容器。
      </p>
      <DemoCard
        title="计数器（可交互）"
        description="Service + observer + useService 的最小组合，点击按钮试试"
        code={counterDemoCode}
      >
        <CounterDemo />
      </DemoCard>

      <h2>从哪里开始</h2>
      <div className="entry-cards">
        <Link className="entry-card" to="/quick-start">
          <h3>传统用法 →</h3>
          <p>
            快速开始、在线 Demo、Service 容器 / Observer / DevTools 使用指南，
            适合先上手写代码的你。
          </p>
        </Link>
        <Link className="entry-card" to="/ai">
          <h3>AI 用法 →</h3>
          <p>
            面向 AI 编程的玩法：rab-react / rab-cdp-debug Skill 与
            @rabjs/web-mcp，让 AI 直接读写应用状态。
          </p>
        </Link>
      </div>
    </div>
  );
}
