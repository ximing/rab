import { useEffect, useRef, useState } from "react";
import { observer } from "@rabjs/react";
import {
  McpBridge,
  type ModelContextApi,
  type WebMcpToolDefinition,
} from "@rabjs/web-mcp";
import { demoContainer, todoService } from "./WebMcpService";

/**
 * WebMCP 桥接 live demo
 *
 * 真实的 WebMCP 消费方是浏览器里的 AI Agent（通过 navigator.modelContext
 * 发现工具）。这里用一个最小 mock 实现顶替 navigator.modelContext，
 * 让页面可以：
 * 1. 展示 McpBridge 真实注册出来的工具清单；
 * 2. 模拟 Agent 调用工具（list_services / get_state / execute_action /
 *    @mcpTool 独立工具），验证「AI 与人的操作落在同一份响应式状态上」。
 *
 * 桥接相关的 Service / 容器定义见 WebMcpService.ts。
 */

interface MockModelContext extends ModelContextApi {
  tools: Map<string, WebMcpToolDefinition>;
}

/**
 * 用 mock 顶替 navigator.modelContext。
 *
 * 注意：支持 WebMCP 的浏览器里 modelContext 是 Navigator.prototype 上
 * 只有 getter 的原生属性，直接赋值会抛 TypeError，必须通过
 * defineProperty 在实例上遮蔽它；卸载时 delete 即可还原原生 getter。
 * 属性不可配置（无法遮蔽）时返回 null，demo 降级为提示。
 */
function installMockModelContext(): MockModelContext | null {
  const tools = new Map<string, WebMcpToolDefinition>();
  const mock: MockModelContext = {
    tools,
    registerTool(tool) {
      tools.set(tool.name, tool);
      return {
        unregister() {
          tools.delete(tool.name);
        },
      };
    },
  };
  try {
    Object.defineProperty(navigator, "modelContext", {
      configurable: true,
      get: () => mock,
    });
    return mock;
  } catch {
    return null;
  }
}

function uninstallMockModelContext() {
  delete (navigator as { modelContext?: unknown }).modelContext;
}

/** 应用状态视图：observer 追踪 todos，Agent 的修改同样会驱动这里重渲染 */
const StateView = observer(() => (
  <ul style={{ margin: "8px 0", paddingLeft: 20 }}>
    {todoService.todos.map((todo, i) => (
      <li key={i}>{todo}</li>
    ))}
  </ul>
));

export default function WebMcpDemo() {
  const [toolNames, setToolNames] = useState<string[]>([]);
  const [toolResult, setToolResult] = useState("");
  const mockRef = useRef<MockModelContext | null>(null);

  useEffect(() => {
    const mock = installMockModelContext();
    if (!mock) {
      setToolResult("当前浏览器的 navigator.modelContext 无法被 mock 遮蔽，live demo 不可用");
      return;
    }
    mockRef.current = mock;

    const bridge = new McpBridge();
    let disposed = false;
    bridge.mount(demoContainer).then(() => {
      if (!disposed) setToolNames([...mock.tools.keys()]);
    });

    return () => {
      disposed = true;
      bridge.unmount();
      uninstallMockModelContext();
    };
  }, []);

  /** 模拟 AI Agent：按名字找到工具并调用，把返回值展示出来 */
  async function callTool(name: string, input: unknown) {
    const tool = mockRef.current?.tools.get(name);
    if (!tool) {
      setToolResult(`工具 ${name} 尚未注册`);
      return;
    }
    const res = await tool.execute(input);
    setToolResult(JSON.stringify(res, null, 2));
  }

  const instanceId = todoService.instanceId;

  return (
    <div>
      <p style={{ margin: "0 0 4px", color: "var(--text-dim)" }}>
        应用状态（instanceId: <code>{instanceId}</code>）
      </p>
      <StateView />
      <div className="demo-row" style={{ marginBottom: 12 }}>
        <button
          className="demo-btn"
          onClick={() => todoService.add(`手动添加 #${todoService.todos.length}`)}
        >
          人：添加待办
        </button>
      </div>

      <p style={{ margin: "0 0 4px", color: "var(--text-dim)" }}>
        已注册到 navigator.modelContext 的工具：
      </p>
      <div className="demo-row" style={{ marginBottom: 12 }}>
        {toolNames.map((name) => (
          <code key={name}>{name}</code>
        ))}
      </div>

      <p style={{ margin: "0 0 4px", color: "var(--text-dim)" }}>
        模拟 Agent 调用：
      </p>
      <div className="demo-row" style={{ marginBottom: 12 }}>
        <button className="demo-btn" onClick={() => callTool("list_services", {})}>
          list_services
        </button>
        <button
          className="demo-btn"
          onClick={() => callTool("get_state", { instanceId })}
        >
          get_state
        </button>
        <button
          className="demo-btn primary"
          onClick={() =>
            callTool("execute_action", {
              instanceId,
              action: "add",
              args: ["来自 AI Agent 的待办"],
            })
          }
        >
          execute_action: add
        </button>
        <button
          className="demo-btn"
          onClick={() => callTool("TodoService__clear", { instanceId, args: [] })}
        >
          TodoService__clear
        </button>
      </div>

      {toolResult ? (
        <pre
          style={{
            margin: 0,
            padding: 12,
            background: "var(--code-bg)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12.5,
            maxHeight: 260,
            overflow: "auto",
          }}
        >
          {toolResult}
        </pre>
      ) : null}
    </div>
  );
}
