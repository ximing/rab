import { CodeBlock } from "../../components/CodeBlock";
import { DemoCard } from "../../components/DemoCard";
import WebMcpDemo, { webMcpDemoCode } from "../../demos/web-mcp";

const registryCode = `// 应用入口（如 main.tsx）—— 唯一改动，初始化一次
import { McpRegistry } from "@rabjs/web-mcp";

McpRegistry.getInstance().mount();`;

const bridgeCode = `import { Container } from "@rabjs/service";
import { McpBridge } from "@rabjs/web-mcp";

const container = new Container({ name: "app" });
container.register(CartService);
container.resolve(CartService); // 触发实例化

const bridge = new McpBridge();
await bridge.mount(container);

// 卸载
bridge.unmount();`;

const serviceCode = `import { Service } from "@rabjs/react";
import { mcpTool } from "@rabjs/web-mcp";
import { z } from "zod";

export class CartService extends Service {
  items: Array<{ id: string; name: string; price: number }> = [];

  get total() {
    return this.items.reduce((sum, item) => sum + item.price, 0);
  }

  // 写法一：Zod Tuple 按位置描述参数（推荐，类型安全）
  @mcpTool({
    description: "添加商品到购物车",
    inputSchema: z.tuple([
      z.object({ id: z.string(), name: z.string(), price: z.number() })
        .describe("商品"),
    ]),
  })
  addItem(item: { id: string; name: string; price: number }) {
    this.items.push(item);
  }

  // 写法二：params 数组（快速书写，无 Zod 校验）
  @mcpTool({
    description: "移除购物车中的商品",
    params: [{ type: "string", description: "商品 ID", required: true }],
  })
  removeItem(productId: string) {
    this.items = this.items.filter((item) => item.id !== productId);
  }
}`;

const agentCode = `// 1. 发现页面里已激活的 Service 实例
list_services({})
// -> { services: [{ instanceId: "CartService_xxx", containerName: "...",
//      actions: [...], scalarState: { ... }, objectState: ["items"] }] }

// 2. 读取状态（复杂对象只回类型摘要，避免大对象序列化 crash）
get_state({ instanceId: "CartService_xxx" })

// 3. 调用方法（支持 assertAfter：一次调用完成"操作 + 断言"）
execute_action({
  instanceId: "CartService_xxx",
  action: "addItem",
  args: [{ id: "1", name: "Apple", price: 5 }],
  assertAfter: [{ path: "items.length", op: "eq", expected: 1 }],
})

// 4. 直接改状态（仅限已存在的公开属性；改动触发响应式更新）
set_state({ instanceId: "CartService_xxx", patch: { ... } })

// 5. 批量断言状态
assert_state({
  instanceId: "CartService_xxx",
  assertions: [{ path: "items.length", op: "gte", expected: 1 }],
})

// @mcpTool 标注的方法还有独立工具，带精准描述与参数 Schema：
CartService__addItem({
  instanceId: "CartService_xxx",
  args: [{ id: "2", name: "Banana", price: 3 }],
})`;

/**
 * @rabjs/web-mcp（路由 /ai/web-mcp）
 *
 * 内容以 packages/web-mcp/src 的真实导出为准：
 * McpRegistry / McpBridge / mcpTool + 5 个通用工具。
 */
export default function WebMcp() {
  return (
    <div>
      <h1>@rabjs/web-mcp</h1>
      <p>
        <code>@rabjs/web-mcp</code> 把 <code>@rabjs/service</code> 的 Service
        系统与 WebMCP 协议桥接：挂载后，页面里的 Service 实例会以标准 MCP
        工具的形式注册到 <code>navigator.modelContext</code>
        ，浏览器里的 AI Agent 可以发现它们、读状态、改状态、调方法、跑断言。
        所有修改都走响应式系统，页面照常重渲染。
      </p>
      <CodeBlock language="bash">{`pnpm add @rabjs/web-mcp`}</CodeBlock>
      <p>
        环境要求：需要浏览器提供 <code>navigator.modelContext</code>{" "}
        （WebMCP）。挂载时会自动尝试加载可选 polyfill{" "}
        <code>@mcp-b/global</code>，加载失败则静默跳过；两者都不可用时挂载
        不会生效（控制台有警告）。peer 依赖：<code>@rabjs/service</code>
        ，以及可选的 <code>zod</code>（仅 Zod 写法需要）。
      </p>

      <h2>接入方式一：McpRegistry（React / 多容器场景，推荐）</h2>
      <p>
        单例注册器，挂载后实时遍历全局容器树（<code>getGlobalContainer()</code>
        及其所有子容器），自动感知 <code>bindServices</code>
        创建的子容器里每一个已实例化的 Service。只需在应用入口调用一次：
      </p>
      <CodeBlock language="ts" title="main.tsx">
        {registryCode}
      </CodeBlock>
      <p>
        它依赖两个 Service 容器能力：每个实例的唯一 <code>instanceId</code>
        （路由主键），以及容器的 <code>getServiceDefinitions()</code> /{" "}
        <code>events</code>（<code>service:instantiated</code>、
        <code>child:added</code> 事件）——新挂载的页面组件一旦实例化
        Service，对应工具即刻可用。
      </p>

      <h2>接入方式二：McpBridge（单容器 / 手动管理场景）</h2>
      <CodeBlock language="ts">{bridgeCode}</CodeBlock>

      <h2>注册出来的工具</h2>
      <p>挂载后，Agent 可以使用这些通用工具（McpBridge 注册前四个）：</p>
      <ul>
        <li>
          <code>list_services</code> — 列出所有已激活的 Service
          实例：instanceId、方法列表、scalarState（基本类型字段及类型）、
          objectState（复杂对象字段名，可用点分路径深入）。
        </li>
        <li>
          <code>execute_action</code> — 调用指定实例的方法；可选{" "}
          <code>assertAfter</code> 在一次调用内完成「操作 + 断言」，异步方法会等
          Promise resolve 后再断言。
        </li>
        <li>
          <code>get_state</code> — 状态快照：标量字段返回当前值，复杂对象只返回
          类型摘要（<code>[Object]</code> / <code>[Array(N)]</code>
          ），避免大对象序列化 crash；附方法的 loading / error 状态。
        </li>
        <li>
          <code>set_state</code> — 直接改状态，仅允许已存在的公开属性（非函数、
          非私有），修改触发响应式更新。
        </li>
        <li>
          <code>assert_state</code> — 批量断言（eq / gt / exists / includes /
          deepEq / some / every 等 23 种操作符），断言在浏览器内执行，返回完整
          报告。
        </li>
      </ul>

      <h2>@mcpTool：把业务方法暴露为独立工具</h2>
      <p>
        通用工具之外，用 <code>@mcpTool</code> 标注的方法会额外注册为独立工具，
        名字默认是 <code>{"{ServiceName}__{methodName}"}</code>
        ，带精准描述和参数 Schema，Agent 更容易正确使用：
      </p>
      <CodeBlock language="ts" title="cart.service.ts">
        {serviceCode}
      </CodeBlock>

      <h2>Agent 侧的完整调用流程</h2>
      <CodeBlock language="text">{agentCode}</CodeBlock>

      <h2>在线体验</h2>
      <p>
        当前浏览器大概率没有 <code>navigator.modelContext</code>
        ，所以这个 demo 用一个最小 mock 顶替它——桥接本身（McpBridge +
        TodoService + @mcpTool）跑的是真实代码。点击下面的按钮模拟 Agent
        调用，观察「AI 的修改和人的修改落在同一份响应式状态上」：
      </p>
      <DemoCard
        title="WebMCP 桥接（可交互）"
        description="McpBridge + 独立容器 + @mcpTool，mock navigator.modelContext 模拟 Agent 调用"
        code={webMcpDemoCode}
      >
        <WebMcpDemo />
      </DemoCard>
    </div>
  );
}
