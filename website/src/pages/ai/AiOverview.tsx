import { Link } from "react-router-dom";
import { CodeBlock } from "../../components/CodeBlock";

const skillSetupCode = `# 方式一：全局安装（所有项目生效）
cp -r ai/skills/rab-react ~/.claude/skills/
cp -r ai/skills/rab-cdp-debug ~/.claude/skills/

# 方式二：项目级安装（只对当前项目生效，可随仓库分发）
cp -r ai/skills/rab-react your-project/.claude/skills/`;

const webMcpSetupCode = `pnpm add @rabjs/web-mcp

// 应用入口初始化一次（React / 多容器场景）
import { McpRegistry } from "@rabjs/web-mcp";
McpRegistry.getInstance().mount();`;

/**
 * AI 用法总览（路由 /ai）
 *
 * RAB 为 AI 编程提供两样东西：
 * 1. Claude Code skills（仓库 ai/skills/ 下）：让 AI 助手懂 RAB 的正确写法、
 *    会通过 CDP 调试运行中的 rab 应用；
 * 2. @rabjs/web-mcp：把应用的 Service 状态系统桥接为 WebMCP 工具，
 *    让浏览器里的 AI Agent 直接读取/操作应用状态。
 */
export default function AiOverview() {
  return (
    <div>
      <h1>AI 用法总览</h1>
      <p>
        RAB 的状态集中在 Service 容器里：可枚举（每个实例有唯一的{" "}
        <code>instanceId</code>）、可遍历（容器树）、可桥接。基于这个特点，
        RAB 为 AI 编程提供两个方向的能力。
      </p>

      <h2>方向一：Claude Code Skills —— 让 AI 懂 RAB</h2>
      <p>
        仓库 <code>ai/skills/</code> 下维护了两个 Claude Code skill：
      </p>
      <ul>
        <li>
          <strong>rab-react</strong>：教 AI 助手按 <code>@rabjs/react</code>{" "}
          的正确约定写代码（<code>observer</code> / <code>useService</code> /{" "}
          <code>bindServices</code> / Service 生命周期等），避免编造 API、
          踩解构 observable 之类的坑。
        </li>
        <li>
          <strong>rab-cdp-debug</strong>：教 AI 助手通过 Chrome DevTools MCP 的{" "}
          <code>evaluate_script</code> 连接运行中的 rab 应用，枚举、读取、调用
          并断言页面里的 Service 实例，完成逻辑验证。
        </li>
      </ul>
      <p>最小接入路径：把 skill 目录拷到 Claude Code 的 skills 目录即可。</p>
      <CodeBlock language="bash" title="安装 skills">
        {skillSetupCode}
      </CodeBlock>

      <h2>方向二：@rabjs/web-mcp —— 让 AI 操作应用状态</h2>
      <p>
        <code>@rabjs/web-mcp</code> 在运行时把 Service 系统桥接成标准的 WebMCP
        工具（注册到 <code>navigator.modelContext</code>）。浏览器里的 AI
        Agent 可以发现页面里所有已激活的 Service 实例，读状态、改状态、调方法、
        跑断言——改动走响应式系统，页面照常更新。
      </p>
      <CodeBlock language="bash" title="安装与初始化">{webMcpSetupCode}</CodeBlock>

      <h2>建议的上手顺序</h2>
      <ol>
        <li>
          装上 <Link to="/ai/skill-rab-react">rab-react Skill</Link>
          ，让 AI 帮你把 RAB 代码写对；
        </li>
        <li>
          应用接入 <code>@rabjs/devtools</code> 后，用{" "}
          <Link to="/ai/skill-cdp-debug">rab-cdp-debug Skill</Link>{" "}
          让 AI 连上运行中的页面做验证和调试；
        </li>
        <li>
          需要浏览器内 Agent 自主操作应用时，再接入{" "}
          <Link to="/ai/web-mcp">@rabjs/web-mcp</Link>。
        </li>
      </ol>

      <div className="entry-cards">
        <Link className="entry-card" to="/ai/skill-rab-react">
          <h3>rab-react Skill →</h3>
          <p>让 AI 按 RAB 约定生成响应式状态代码，含 references 与 evals 说明。</p>
        </Link>
        <Link className="entry-card" to="/ai/skill-cdp-debug">
          <h3>rab-cdp-debug Skill →</h3>
          <p>让 AI 通过 CDP 查看、调用、断言运行中应用的 Service 状态。</p>
        </Link>
        <Link className="entry-card" to="/ai/web-mcp">
          <h3>@rabjs/web-mcp →</h3>
          <p>把 Service 暴露为 WebMCP 工具，浏览器内 Agent 直接读写应用状态。</p>
        </Link>
      </div>
    </div>
  );
}
