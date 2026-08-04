import { CodeBlock } from "../../components/CodeBlock";

const installCode = `# skill 源文件在 rab 仓库的 ai/skills/rab-cdp-debug/ 下
cp -r rab/ai/skills/rab-cdp-debug ~/.claude/skills/        # 全局
# 或
cp -r rab/ai/skills/rab-cdp-debug your-project/.claude/skills/  # 项目级`;

const setupCode = `pnpm add @rabjs/devtools

// 应用入口（如 main.tsx）调用一次，SSR 环境下会自动跳过
import { setupWindowRootContainer } from "@rabjs/devtools";
setupWindowRootContainer();`;

const handleApiCode = `interface RSRootContainerHandle {
  container: Container;  // global 容器实例
  getService(instanceId: string): Service | undefined;
  getContainer(containerName: string): Container | undefined;
  listServices(): Array<{
    instanceId: string;       // 格式: ClassName_nanoid
    containerName: string;    // bindServices options.name 或自动生成
    identifierLabel: string;  // Service 类名
    instance: Service;        // 内存对象引用，可直接操控
  }>;
}`;

const flowCode = `// Step 1：确认 handle 已挂载
() => typeof window.__RS_ROOT_CONTAINER__
// 期望: "object"

// Step 2：枚举所有已实例化的 Service，找到目标
() => window.__RS_ROOT_CONTAINER__?.listServices().map(s => ({
  instanceId: s.instanceId,
  identifierLabel: s.identifierLabel,
  containerName: s.containerName,
}))

// Step 3：取出 Service 当前状态快照
() => {
  const svc = window.__RS_ROOT_CONTAINER__?.getService("CartService_abc12");
  return svc ? { total: svc.total, count: svc.items.length } : null;
}

// Step 4：触发操作（调用方法 / 修改状态）
() => {
  const entry = window.__RS_ROOT_CONTAINER__?.listServices()
    .find(s => s.identifierLabel === "CartService");
  entry?.instance.addItem({ id: "1", name: "Apple", price: 5 });
  return { ok: true };
}

// Step 5：验证状态变更
() => {
  const svc = window.__RS_ROOT_CONTAINER__?.getService("CartService_abc12");
  return { total: svc?.total, count: svc?.items.length };
}`;

const assertCode = `() => {
  const handle = window.__RS_ROOT_CONTAINER__;
  if (!handle) return { error: "未挂载" };
  const result = handle
    .expect("CartService_abc123")
    .describe("加购后状态验证")
    .toBe("items.length", 3)          // 相等
    .toBeGreaterThan("total", 0)      // 数值比较
    .toExist("currentUser")           // 存在性
    .run();                           // 返回可序列化的结构化结果
  return { passed: result.passed, summary: result.summary };
}`;

const promptCode = `你：帮我验证一下购物车页的加购逻辑：现在购物车是空的，
    调用 CartService 的 addItem 加一件商品，然后确认 items.length
    变成 1、total 大于 0。页面已经在 Chrome 里开着。

Claude（触发 rab-cdp-debug skill 后）：
  1. evaluate_script 检查 window.__RS_ROOT_CONTAINER__ 是否存在
  2. listServices() 找到 CartService 的 instanceId
  3. getService(instanceId) 读取初始状态（items.length === 0）
  4. 调用 entry.instance.addItem(...)
  5. handle.expect(instanceId).toBe("items.length", 1)
       .toBeGreaterThan("total", 0).run() 验证并返回断言报告`;

/**
 * rab-cdp-debug Skill（路由 /ai/skill-cdp-debug）
 *
 * 内容以仓库 ai/skills/rab-cdp-debug/SKILL.md 为准。
 */
export default function SkillCdpDebug() {
  return (
    <div>
      <h1>rab-cdp-debug Skill</h1>
      <p>
        <code>rab-cdp-debug</code> 是一个 Claude Code skill，源文件在仓库{" "}
        <code>ai/skills/rab-cdp-debug/</code> 下。它教 AI 助手通过 Chrome
        DevTools MCP 的 <code>evaluate_script</code> 工具，利用{" "}
        <code>@rabjs/devtools</code> 挂载的{" "}
        <code>window.__RS_ROOT_CONTAINER__</code> 句柄，对运行中的 rab
        应用做 Service 层的功能验证与状态检查：枚举 Service、读状态、调方法、
        跑断言。
      </p>

      <h2>前置条件</h2>
      <ol>
        <li>
          应用接入 <code>@rabjs/devtools</code> 并在入口显式初始化——{" "}
          <code>window.__RS_ROOT_CONTAINER__</code>{" "}
          <strong>不会自动挂载</strong>：
          <CodeBlock language="tsx">{setupCode}</CodeBlock>
        </li>
        <li>
          AI 助手侧配置好 Chrome DevTools MCP（skill 通过它的{" "}
          <code>evaluate_script</code> 工具在页面里执行 JavaScript）。
        </li>
        <li>安装 skill 本身：</li>
      </ol>
      <CodeBlock language="bash">{installCode}</CodeBlock>

      <h2>核心概念：容器树与调试句柄</h2>
      <p>
        <code>setupWindowRootContainer()</code> 挂载的句柄暴露整棵容器树的查询
        接口：根部是与 React 无关的 global 容器，下面依次是 RSRoot、页面级、
        Domain 级的 <code>bindServices</code> 容器。
      </p>
      <CodeBlock language="ts" title="RSRootContainerHandle">
        {handleApiCode}
      </CodeBlock>
      <p>
        <code>evaluate_script</code> 的返回值必须是 JSON
        可序列化的——Service 实例不能跨进程传递，所以所有操作都在脚本内部完成，
        只把基础类型、普通对象作为结果返回。
      </p>

      <h2>典型验证流程</h2>
      <p>skill 约定了一套五步流程（确认句柄 → 枚举 → 快照 → 操作 → 验证）：</p>
      <CodeBlock language="js" title="evaluate_script 函数体序列">
        {flowCode}
      </CodeBlock>

      <h2>链式断言：RSExpectBuilder</h2>
      <p>
        <code>@rabjs/devtools</code> 还提供链式断言 API，通过{" "}
        <code>handle.expect(instanceId)</code> 创建（或独立函数{" "}
        <code>rsExpect(instance)</code>）。断言是懒执行的，三种执行模式：
      </p>
      <ul>
        <li>
          <code>.run()</code> — 返回结构化结果（可 JSON 序列化，适合
          evaluate_script 回传）；
        </li>
        <li>
          <code>.check()</code> — 控制台输出彩色报告，返回 boolean；
        </li>
        <li>
          <code>.expect()</code> — 失败时抛出 <code>RSAssertionError</code>
          （类 Jest 语义，适合 E2E 脚本）。
        </li>
      </ul>
      <CodeBlock language="js">{assertCode}</CodeBlock>
      <p>
        断言方法覆盖相等、数值比较、存在性、包含、正则、类型、长度、对象键 /
        子集匹配、数组 some/every 等（<code>path</code>{" "}
        参数支持点号路径深入嵌套属性），完整速查表见 skill 源文件。
      </p>

      <h2>示例 prompt</h2>
      <CodeBlock language="text">{promptCode}</CodeBlock>

      <h2>常见问题（skill 内置）</h2>
      <ul>
        <li>
          <code>window.__RS_ROOT_CONTAINER__</code> 为 undefined：页面尚未完成
          加载，稍等重试；或应用没调用 <code>setupWindowRootContainer()</code>。
        </li>
        <li>
          <code>getService</code> 找不到：只有被 <code>resolve</code>{" "}
          实例化过的 Service 才会出现，先 <code>listServices()</code> 确认。
        </li>
        <li>
          返回值 undefined / 不完整：检查是否返回了 Service 实例或循环引用对象，
          只回传可序列化字段。
        </li>
      </ul>
    </div>
  );
}
