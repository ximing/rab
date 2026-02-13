/**
 * useObserverService Hook 演示
 *
 * 展示如何在 React 组件中使用 useObserverService Hook 获取服务实例并自动追踪响应式更新
 *
 * 关键点：
 * 1. useObserverService 结合了 useService 和 useObserver 的功能
 * 2. 自动追踪 selector 返回的值的变化
 * 3. 当被追踪的值变化时，组件会自动重新渲染
 * 4. 不需要使用 observer HOC 包装组件
 * 5. 支持选择器函数，可以选择特定的属性或计算值
 */

import { DeleteOutlined, PlusOutlined, ClearOutlined } from '@ant-design/icons';
import { bindServices, useObserverService } from '@rabjs/react';
import {
  Card,
  Button,
  Space,
  List,
  Tag,
  Empty,
  Progress,
  Divider,
  Row,
  Col,
  Checkbox,
  Radio,
} from 'antd';
import { useState } from 'react';

import type { Todo } from './TodoService';
import { TodoService } from './TodoService';

/**
 * Todo 列表组件 - 使用 useObserverService 自动追踪过滤后的 todos
 *
 * 这个组件展示了如何使用 selector 函数来选择特定的 observable 属性
 * 当 filteredTodos 变化时，组件会自动重新渲染
 */
const TodoListComponent = () => {
  // 使用 selector 选择 filteredTodos，自动追踪其变化
  const [filteredTodos, todoService] = useObserverService(
    TodoService,
    service => service.filteredTodos
  );

  return (
    <Card title="Todo 列表" size="small">
      {filteredTodos.length === 0 ? (
        <Empty description="暂无 Todo" />
      ) : (
        <List
          dataSource={filteredTodos}
          renderItem={(todo: Todo) => (
            <List.Item
              key={todo.id}
              actions={[
                <Checkbox
                  checked={todo.completed}
                  onChange={() => todoService.toggleTodo(todo.id)}
                />,
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => todoService.removeTodo(todo.id)}
                />,
              ]}
            >
              <List.Item.Meta
                title={
                  <span
                    style={{
                      textDecoration: todo.completed ? 'line-through' : 'none',
                      color: todo.completed ? '#999' : 'inherit',
                    }}
                  >
                    {todo.title}
                  </span>
                }
                description={
                  <Space size="small">
                    <Tag
                      color={
                        todo.priority === 'high'
                          ? 'red'
                          : todo.priority === 'medium'
                          ? 'orange'
                          : 'green'
                      }
                    >
                      {todo.priority}
                    </Tag>
                    <span>{todo.createdAt.toLocaleDateString()}</span>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Card>
  );
};

/**
 * 统计信息组件 - 使用 useObserverService 自动追踪统计数据
 *
 * 这个组件展示了如何使用 selector 选择 computed 属性
 */
const StatsComponent = () => {
  // 使用 selector 选择 stats 对象，自动追踪其变化
  const [stats] = useObserverService(TodoService, service => service.stats);

  // 使用 selector 选择完成率，自动追踪其变化
  const [completionRate] = useObserverService(TodoService, service => service.completionRate);

  return (
    <Card title="统计信息" size="small">
      <Space direction="vertical" style={{ width: '100%' }}>
        <div>
          <strong>总数:</strong> <Tag>{stats.total}</Tag>
        </div>
        <div>
          <strong>已完成:</strong> <Tag color="success">{stats.completed}</Tag>
        </div>
        <div>
          <strong>未完成:</strong> <Tag color="processing">{stats.active}</Tag>
        </div>
        <div>
          <strong>高优先级:</strong> <Tag color="red">{stats.highPriority}</Tag>
        </div>
        <div>
          <strong>完成率:</strong>
          <Progress percent={completionRate} />
        </div>
      </Space>
    </Card>
  );
};

/**
 * 过滤器组件 - 使用 useObserverService 自动追踪当前过滤器
 */
const FilterComponent = () => {
  // 使用 selector 选择 filter，自动追踪其变化
  const [currentFilter, todoService] = useObserverService(TodoService, service => service.filter);

  return (
    <Card title="过滤器" size="small">
      <Radio.Group
        value={currentFilter}
        onChange={e => todoService.setFilter(e.target.value)}
        style={{ width: '100%' }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Radio value="all">全部</Radio>
          <Radio value="active">未完成</Radio>
          <Radio value="completed">已完成</Radio>
        </Space>
      </Radio.Group>
    </Card>
  );
};

/**
 * 添加 Todo 组件
 */
const AddTodoComponent = () => {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [, todoService] = useObserverService(TodoService, service => service.todos);

  const handleAdd = () => {
    if (title.trim()) {
      todoService.addTodo(title, priority);
      setTitle('');
      setPriority('medium');
    }
  };

  return (
    <Card title="添加 Todo" size="small">
      <Space direction="vertical" style={{ width: '100%' }}>
        <input
          type="text"
          placeholder="输入 Todo 标题"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && handleAdd()}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #d9d9d9',
            borderRadius: '4px',
          }}
        />
        <Radio.Group
          value={priority}
          onChange={e => setPriority(e.target.value)}
          style={{ width: '100%' }}
        >
          <Space>
            <Radio value="low">低</Radio>
            <Radio value="medium">中</Radio>
            <Radio value="high">高</Radio>
          </Space>
        </Radio.Group>
        <Button type="primary" block icon={<PlusOutlined />} onClick={handleAdd}>
          添加
        </Button>
      </Space>
    </Card>
  );
};

/**
 * 操作组件
 */
const ActionsComponent = () => {
  const [, todoService] = useObserverService(TodoService, service => service.todos);

  return (
    <Card title="操作" size="small">
      <Button block danger icon={<ClearOutlined />} onClick={() => todoService.clearCompleted()}>
        清除已完成的 Todo
      </Button>
    </Card>
  );
};

/**
 * 主组件 - 使用 RSDomain 提供 TodoService
 */
const UseObserverServiceDemoContent = () => {
  return (
    <div>
      <Card type="inner" title="useObserverService Hook 演示" style={{ marginBottom: 24 }}>
        <p>
          <strong>useObserverService</strong> 结合了 <code>useService</code> 和{' '}
          <code>useObserver</code> 的功能，让你可以在不使用 observer HOC 的情况下实现响应式更新。
        </p>
        <p>
          关键特性：
          <ul>
            <li>自动追踪 selector 返回的值的变化</li>
            <li>当被追踪的值变化时，组件会自动重新渲染</li>
            <li>支持选择器函数，可以选择特定的属性或计算值</li>
            <li>不需要使用 observer HOC 包装组件</li>
            <li>返回 [selectedState, service] 元组</li>
          </ul>
        </p>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <AddTodoComponent />
            <FilterComponent />
            <ActionsComponent />
          </Space>
        </Col>
        <Col xs={24} sm={12}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <StatsComponent />
            <TodoListComponent />
          </Space>
        </Col>
      </Row>

      <Divider />

      <Card title="使用示例" size="small">
        <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, overflow: 'auto' }}>
          {`// 基础用法 - 选择单个属性
const [filteredTodos, todoService] = useObserverService(
  TodoService,
  service => service.filteredTodos
);

// 选择多个属性
const [{ total, completed }, todoService] = useObserverService(
  TodoService,
  service => ({ total: service.stats.total, completed: service.stats.completed })
);

// 选择计算属性
const [completionRate, todoService] = useObserverService(
  TodoService,
  service => service.completionRate
);

// 在组件中使用
return (
  <div>
    <p>完成率: {completionRate}%</p>
    <button onClick={() => todoService.addTodo('新任务')}>
      添加任务
    </button>
  </div>
);`}
        </pre>
      </Card>

      <Card title="与 useService 的区别" size="small" style={{ marginTop: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #d9d9d9' }}>
              <th style={{ padding: 8, textAlign: 'left' }}>特性</th>
              <th style={{ padding: 8, textAlign: 'left' }}>useService</th>
              <th style={{ padding: 8, textAlign: 'left' }}>useObserverService</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #d9d9d9' }}>
              <td style={{ padding: 8 }}>获取服务实例</td>
              <td style={{ padding: 8 }}>✅</td>
              <td style={{ padding: 8 }}>✅</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #d9d9d9' }}>
              <td style={{ padding: 8 }}>自动追踪响应式更新</td>
              <td style={{ padding: 8 }}>❌</td>
              <td style={{ padding: 8 }}>✅</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #d9d9d9' }}>
              <td style={{ padding: 8 }}>需要 observer HOC</td>
              <td style={{ padding: 8 }}>✅</td>
              <td style={{ padding: 8 }}>❌</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #d9d9d9' }}>
              <td style={{ padding: 8 }}>支持选择器函数</td>
              <td style={{ padding: 8 }}>❌</td>
              <td style={{ padding: 8 }}>✅</td>
            </tr>
            <tr>
              <td style={{ padding: 8 }}>返回值</td>
              <td style={{ padding: 8 }}>service</td>
              <td style={{ padding: 8 }}>[selectedState, service]</td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
};

/**
 * 导出组件 - 使用 RSDomain 包装
 */
export default bindServices(UseObserverServiceDemoContent, [TodoService]);
