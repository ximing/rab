import { Link } from "react-router-dom";
import { CodeBlock } from "../components/CodeBlock";
import { DemoCard } from "../components/DemoCard";
import { SignalDemo } from "../components/SignalDemo";
import CounterDemo, { counterDemoCode } from "../demos/counter";

const installCode = `pnpm add @rabjs/service @rabjs/react
# 可选：调试工具 / AI 桥接
pnpm add @rabjs/devtools @rabjs/web-mcp`;

export default function Home() {
  return (
    <div className="hero -mt-4">
      <div className="hero-stage">
        <div className="hero-grid" />
        <div className="relative">
          <p className="eyebrow">
            <span className="tick" />
            Reactive State · For Humans &amp; Agents
          </p>
          <h1 className="hero-title">
            RAB<span className="pulse-dot" />
          </h1>
          <p className="tagline">
            状态以「服务」为单位组织：<code>@rabjs/service</code> 服务容器 +{" "}
            <code>@rabjs/observer</code> 观察者 + <code>@rabjs/react</code>{" "}
            集成。同一份响应式状态，人点按钮能改，AI 调工具也能改。
          </p>

          <SignalDemo />
        </div>
      </div>

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
        <Link
          className="entry-card"
          style={{ "--card-accent": "var(--human)" } as React.CSSProperties}
          to="/quick-start"
        >
          <p className="eyebrow mb-2">
            <span className="tick human" />
            人写代码
          </p>
          <h3>传统用法 →</h3>
          <p>
            快速开始、在线 Demo、Service 容器 / Observer / DevTools 使用指南，
            适合先上手写代码的你。
          </p>
        </Link>
        <Link className="entry-card" to="/ai">
          <p className="eyebrow mb-2">
            <span className="tick" />
            AI 读写状态
          </p>
          <h3>AI 用法 →</h3>
          <p>
            面向 AI 编程的玩法：rab-react / rab-cdp-debug / rab-rn-debug
            Skill 与 @rabjs/web-mcp，让 AI 直接读写应用状态。
          </p>
        </Link>
      </div>
    </div>
  );
}
