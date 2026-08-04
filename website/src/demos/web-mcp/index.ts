import WebMcpDemo from "./WebMcpDemo";

export default WebMcpDemo;
export { TodoService } from "./WebMcpService";

/**
 * 与 live demo 对应的展示源码（DemoCard 的 code 属性使用）。
 * 只保留「定义 Service → 桥接到 WebMCP」的核心链路，
 * live 区里模拟 Agent 调用的 UI 代码不在此展开。
 */
export const webMcpDemoCode = `import { Service } from "@rabjs/react";
import { Container } from "@rabjs/service";
import { McpBridge, mcpTool } from "@rabjs/web-mcp";

// 1. 定义 Service，可用 @mcpTool 标注想暴露给 AI 的方法
class TodoService extends Service {
  todos: string[] = ["学会 @rabjs/web-mcp"];

  add(text: string) {
    this.todos.push(text);
  }

  @mcpTool({ description: "清空所有待办事项", params: [] })
  clear() {
    this.todos = [];
  }
}

// 2. 准备容器并实例化
const container = new Container({ name: "web-mcp-demo" });
container.register(TodoService);
container.resolve(TodoService);

// 3. 桥接到 WebMCP：注册 list_services / execute_action / get_state /
//    set_state 四个通用工具，外加独立工具 TodoService__clear
const bridge = new McpBridge();
await bridge.mount(container);

// AI Agent 侧（通过 navigator.modelContext 发现工具后）：
//   list_services({})                              -> 发现 TodoService 实例
//   execute_action({ instanceId, action: "add",    -> 调用方法，页面响应式更新
//                    args: ["来自 AI 的待办"] })
//   TodoService__clear({ instanceId, args: [] })   -> 调用 @mcpTool 独立工具
`;
