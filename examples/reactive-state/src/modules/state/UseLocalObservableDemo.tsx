/**
 * useLocalObservable Hook 演示页面
 * 展示如何使用 useLocalObservable 创建组件本地的 observable 状态
 */
import { DeleteOutlined, CheckOutlined } from '@ant-design/icons';
import { observer, useLocalObservable } from '@rabjs/react';
import { Button, Card, Input, List, Space, Tag, Typography, Radio } from 'antd';
import { useState } from 'react';

import { createTodoStore } from './TodoStore.js';

const { Title, Paragraph } = Typography;

// 使用 useLocalObservable 创建本地状态的 Todo 应用
const TodoApp = observer(() => {
  // 创建本地 observable 状态
  const store = useLocalObservable(createTodoStore);
  const [inputValue, setInputValue] = useState('');

  const handleAdd = () => {
    if (inputValue.trim()) {
      store.addTodo(inputValue);
      setInputValue('');
    }
  };

  return (
    <Card title="Todo 应用（本地状态）">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* 输入框 */}
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="输入待办事项..."
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onPressEnter={handleAdd}
          />
          <Button type="primary" onClick={handleAdd}>
            添加
          </Button>
        </Space.Compact>

        {/* 过滤器 */}
        <Space>
          <span>筛选:</span>
          <Radio.Group value={store.filter} onChange={e => store.setFilter(e.target.value)}>
            <Radio.Button value="all">全部</Radio.Button>
            <Radio.Button value="active">进行中</Radio.Button>
            <Radio.Button value="completed">已完成</Radio.Button>
          </Radio.Group>
        </Space>

        {/* 统计信息 */}
        <Space>
          <Tag color="blue">总计: {store.stats.total}</Tag>
          <Tag color="orange">进行中: {store.stats.active}</Tag>
          <Tag color="green">已完成: {store.stats.completed}</Tag>
        </Space>

        {/* Todo 列表 */}
        <List
          bordered
          dataSource={store.filteredTodos}
          locale={{ emptyText: '暂无待办事项' }}
          renderItem={todo => (
            <List.Item
              actions={[
                <Button
                  type="text"
                  icon={<CheckOutlined />}
                  onClick={() => store.toggleTodo(todo.id)}
                >
                  {todo.completed ? '取消完成' : '完成'}
                </Button>,
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => store.removeTodo(todo.id)}
                >
                  删除
                </Button>,
              ]}
            >
              <span
                style={{
                  textDecoration: todo.completed ? 'line-through' : 'none',
                  color: todo.completed ? '#999' : '#000',
                }}
              >
                {todo.text}
              </span>
            </List.Item>
          )}
        />

        {/* 清除已完成 */}
        {store.stats.completed > 0 && (
          <Button onClick={() => store.clearCompleted()}>
            清除已完成 ({store.stats.completed})
          </Button>
        )}
      </Space>
    </Card>
  );
});

// 多个独立的 Todo 实例
const MultipleTodoInstances = observer(() => {
  return (
    <Card title="多个独立实例">
      <Paragraph type="secondary">
        每个 TodoApp 组件都有自己独立的状态，互不影响。 这展示了 useLocalObservable
        创建的是组件本地状态。
      </Paragraph>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <TodoApp />
        <TodoApp />
      </Space>
    </Card>
  );
});

export default function UseLocalObservableDemo() {
  return (
    <div>
      <Title level={2}>useLocalObservable Hook 演示</Title>
      <Paragraph>
        <code>useLocalObservable</code> 用于在组件内创建本地的 observable 状态。
        这个状态在组件的整个生命周期中保持不变，并且是响应式的。
      </Paragraph>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <TodoApp />

        <Card title="代码示例">
          <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 4 }}>
            {`import { observer, useLocalObservable } from '@rabjs/react';

const TodoApp = observer(() => {
  // 创建本地 observable 状态
  const store = useLocalObservable(() => ({
    todos: [],
    
    get activeTodos() {
      return this.todos.filter(t => !t.completed);
    },
    
    addTodo(text) {
      this.todos.push({ id: Date.now(), text, completed: false });
    },
    
    toggleTodo(id) {
      const todo = this.todos.find(t => t.id === id);
      if (todo) todo.completed = !todo.completed;
    }
  }));

  return (
    <div>
      <input onKeyPress={e => {
        if (e.key === 'Enter') {
          store.addTodo(e.target.value);
          e.target.value = '';
        }
      }} />
      <ul>
        {store.todos.map(todo => (
          <li key={todo.id} onClick={() => store.toggleTodo(todo.id)}>
            {todo.text}
          </li>
        ))}
      </ul>
    </div>
  );
});`}
          </pre>
        </Card>

        <MultipleTodoInstances />
      </Space>
    </div>
  );
}
