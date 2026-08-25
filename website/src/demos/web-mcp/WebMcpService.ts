import { Service } from '@rabjs/react';
import { Container } from '@rabjs/service';
import { mcpTool } from '@rabjs/web-mcp';

/**
 * 待办 Service —— web-mcp demo 的业务状态。
 *
 * - 普通方法（add）通过通用工具 execute_action 调用；
 * - @mcpTool 标注的方法（clear）会额外注册为独立工具 TodoService__clear，
 *   带有更精准的描述和参数 Schema。
 */
export class TodoService extends Service {
  title = '待办清单';
  todos: string[] = ['学会 @rabjs/web-mcp'];

  add(text: string) {
    this.todos.push(text);
  }

  // 显式命名：生产构建压缩会改写类名，默认的 {类名}__{方法名} 会随之改变
  @mcpTool({
    name: 'TodoService__clear',
    description: '清空所有待办事项',
    params: [],
  })
  clear() {
    this.todos = [];
  }
}

/**
 * 独立容器 + 立即实例化：McpBridge 挂载时就能发现这个 Service。
 * instanceId 由容器在实例化时自动生成（格式 ClassName_nanoid），
 * 是 Agent 调用工具时的路由主键。
 */
export const demoContainer = new Container({ name: 'web-mcp-demo' });
demoContainer.register(TodoService);
export const todoService = demoContainer.resolve(TodoService);
