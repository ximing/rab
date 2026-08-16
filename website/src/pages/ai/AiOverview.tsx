import { Link } from "react-router-dom";
import { CodeBlock } from "../../components/CodeBlock";

const claudeCodeSetupCode = `/plugin marketplace add ximing/rab
/plugin install rab@rab`;

const codexSetupCode = `# Codex 插件市场（CLI 输入 /plugins，App 在 Plugins 侧边栏）搜索 rab 安装
# 上架前可手动安装：
cp -r skills/rab-react skills/rab-cdp-debug skills/rab-rn-debug ~/.codex/skills/`;

const cursorSetupCode = `# Cursor Agent 对话框中执行：
/add-plugin rab
# 或手动安装到项目：
cp -r skills/rab-react skills/rab-cdp-debug skills/rab-rn-debug your-project/.cursor/skills/`;

const grokSetupCode = `grok plugin install rab@xai-official --trust`;

const kimiSetupCode = `/plugins install https://github.com/ximing/rab
# 安装后新开会话（/new）使插件生效`;

const opencodeSetupCode = `// opencode.json（全局或项目级）
{
  "plugin": ["rab@git+https://github.com/ximing/rab.git"]
}`;

const piSetupCode = `pi install git:github.com/ximing/rab`;

const manualSetupCode = `# 通用兜底：skill 是纯 SKILL.md 文档，拷到工具的 skills 目录即可
git clone https://github.com/ximing/rab
cp -r rab/skills/rab-react rab/skills/rab-cdp-debug rab/skills/rab-rn-debug <工具的 skills 目录>/`;

const webMcpSetupCode = `pnpm add @rabjs/web-mcp

// 应用入口初始化一次（React / 多容器场景）
import { McpRegistry } from "@rabjs/web-mcp";
McpRegistry.getInstance().mount();`;

/**
 * AI 用法总览（路由 /ai）
 *
 * RAB 为 AI 编程提供两样东西：
 * 1. 跨工具的 Agent Skills（仓库 skills/ 下）：让 AI 助手懂 RAB 的正确写法、
 *    会通过 CDP / RN debug bridge 调试运行中的 rab 应用；
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

      <h2>方向一：Agent Skills —— 让 AI 懂 RAB</h2>
      <p>
        仓库 <code>skills/</code> 下维护了三个 skill，覆盖写代码和调试两端：
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
        <li>
          <strong>rab-rn-debug</strong>：教 AI 助手通过{" "}
          <code>@rabjs/rn-debug-server</code> 桥接调试真机上的 React Native
          应用：启动本地服务、给设备下发结构化指令、等待执行结果。
        </li>
      </ul>

      <h2>安装 Skills（支持各编程工具）</h2>
      <p>
        这些 skill 是纯 <code>SKILL.md</code> 文档，零运行时依赖，同一份文件
        在各编程工具中通用。仓库内置了各工具的插件清单
        （<code>.claude-plugin/</code>、<code>.codex-plugin/</code>、
        <code>.cursor-plugin/</code>、<code>.kimi-plugin/</code>、
        <code>.opencode/</code> 等），按你使用的工具选择安装方式；同时使用
        多个工具时，需要分别为每个工具安装。
      </p>

      <h3>Claude Code</h3>
      <CodeBlock language="bash" title="Claude Code">
        {claudeCodeSetupCode}
      </CodeBlock>

      <h3>Codex App / Codex CLI</h3>
      <CodeBlock language="bash" title="Codex">
        {codexSetupCode}
      </CodeBlock>

      <h3>Cursor</h3>
      <CodeBlock language="bash" title="Cursor">
        {cursorSetupCode}
      </CodeBlock>

      <h3>Grok Build CLI</h3>
      <CodeBlock language="bash" title="Grok Build CLI">
        {grokSetupCode}
      </CodeBlock>

      <h3>Kimi Code</h3>
      <CodeBlock language="text" title="Kimi Code">
        {kimiSetupCode}
      </CodeBlock>

      <h3>OpenCode</h3>
      <CodeBlock language="json" title="opencode.json">
        {opencodeSetupCode}
      </CodeBlock>

      <h3>Pi</h3>
      <CodeBlock language="bash" title="Pi">
        {piSetupCode}
      </CodeBlock>

      <h3>通用兜底</h3>
      <CodeBlock language="bash" title="手动安装">
        {manualSetupCode}
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
          开发 React Native 应用时，用{" "}
          <Link to="/ai/skill-rn-debug">rab-rn-debug Skill</Link>{" "}
          让 AI 直接调试真机上的应用；
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
        <Link className="entry-card" to="/ai/skill-rn-debug">
          <h3>rab-rn-debug Skill →</h3>
          <p>让 AI 通过本地 debug bridge 调试真机上的 React Native 应用。</p>
        </Link>
        <Link className="entry-card" to="/ai/web-mcp">
          <h3>@rabjs/web-mcp →</h3>
          <p>把 Service 暴露为 WebMCP 工具，浏览器内 Agent 直接读写应用状态。</p>
        </Link>
      </div>
    </div>
  );
}
