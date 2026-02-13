/**
 * TodoList Demo - 展示 observable 和 observer 的基本使用
 *
 * 核心概念:
 * 1. observable: 将普通对象转换为响应式对象
 * 2. observer: 将 React 组件转换为响应式组件,自动追踪依赖并在数据变化时重新渲染
 */
import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { observer } from '@rabjs/react';
import { Badge, Button, Card, Checkbox, Input, List, Radio, Space, Tag, Typography } from 'antd';
import { useState } from 'react';

import { todoStore, type FilterType, type Todo } from './TodoStore.js';

const { Title, Paragraph, Text } = Typography;

/**
 * 添加 TODO 的输入框组件
 * 使用 observer 包装,当 todoStore 变化时自动更新
 */
const TodoInput = observer(() => {
  const [inputValue, setInputValue] = useState('');

  const handleAdd = () => {
    todoStore.addTodo(inputValue);
    setInputValue('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  };

  return (
    <Space.Compact style={{ width: '100%' }}>
      <Input
        placeholder="输入待办事项..."
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        onKeyPress={handleKeyPress}
        size="large"
      />
      <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} size="large">
        添加
      </Button>
    </Space.Compact>
  );
});

/**
 * 单个 TODO 项组件
 * 使用 observer 包装,当 todo 数据变化时自动更新
 */
const TodoItem = observer(({ todo }: { todo: Todo }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(todo.text);

  const handleEdit = () => {
    setIsEditing(true);
    setEditValue(todo.text);
  };

  const handleSave = () => {
    todoStore.editTodo(todo.id, editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(todo.text);
    setIsEditing(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <List.Item
      style={{
        padding: '12px 16px',
        background: todo.completed ? '#f5f5f5' : 'white',
        transition: 'all 0.3s',
      }}
      actions={
        isEditing
          ? [
              <Button
                key="save"
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                onClick={handleSave}
              >
                保存
              </Button>,
              <Button key="cancel" size="small" icon={<CloseOutlined />} onClick={handleCancel}>
                取消
              </Button>,
            ]
          : [
              <Button
                key="edit"
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={handleEdit}
              />,
              <Button
                key="delete"
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => todoStore.removeTodo(todo.id)}
              />,
            ]
      }
    >
      <Space style={{ width: '100%' }}>
        <Checkbox checked={todo.completed} onChange={() => todoStore.toggleTodo(todo.id)} />
        {isEditing ? (
          <Input
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={handleKeyPress}
            autoFocus
            style={{ flex: 1 }}
          />
        ) : (
          <Text
            delete={todo.completed}
            style={{
              flex: 1,
              color: todo.completed ? '#999' : 'inherit',
            }}
          >
            {todo.text}
          </Text>
        )}
      </Space>
    </List.Item>
  );
});

/**
 * TODO 列表组件
 * 使用 observer 包装,当 filteredTodos 变化时自动更新
 */
const TodoList = observer(() => {
  const { filteredTodos } = todoStore;

  if (filteredTodos.length === 0) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
          {todoStore.filter === 'all'
            ? '暂无待办事项,点击上方添加按钮创建'
            : `暂无${todoStore.filter === 'active' ? '未完成' : '已完成'}的待办事项`}
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <List
        dataSource={filteredTodos}
        renderItem={todo => <TodoItem key={todo.id} todo={todo} />}
      />
    </Card>
  );
});

/**
 * 过滤器和统计信息组件
 * 使用 observer 包装,当统计数据变化时自动更新
 */
const TodoFooter = observer(() => {
  const { activeCount, completedCount, filter, todos } = todoStore;

  if (todos.length === 0) {
    return null;
  }

  return (
    <Card>
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* 统计信息 */}
        <Space size="large">
          <Badge count={activeCount} showZero color="blue">
            <Tag color="blue">未完成</Tag>
          </Badge>
          <Badge count={completedCount} showZero color="green">
            <Tag color="green">已完成</Tag>
          </Badge>
          <Badge count={todos.length} showZero color="default">
            <Tag>总计</Tag>
          </Badge>
        </Space>

        {/* 过滤器 */}
        <Space>
          <Text>显示:</Text>
          <Radio.Group
            value={filter}
            onChange={e => todoStore.setFilter(e.target.value as FilterType)}
            buttonStyle="solid"
          >
            <Radio.Button value="all">全部</Radio.Button>
            <Radio.Button value="active">未完成</Radio.Button>
            <Radio.Button value="completed">已完成</Radio.Button>
          </Radio.Group>
        </Space>

        {/* 操作按钮 */}
        <Space>
          {todos.length > 0 && (
            <Button onClick={() => todoStore.toggleAll()}>
              {todoStore.allCompleted ? '取消全部完成' : '全部完成'}
            </Button>
          )}
          {completedCount > 0 && (
            <Button danger onClick={() => todoStore.clearCompleted()}>
              清除已完成 ({completedCount})
            </Button>
          )}
        </Space>
      </Space>
    </Card>
  );
});

/**
 * 主组件 - TodoList Demo
 */
export default function TodoListDemo() {
  return (
    <div>
      <Title level={2}>TodoList Demo - Observable & Observer</Title>

      <Paragraph>
        这个示例展示了如何使用 <code>observable</code> 和 <code>observer</code> 创建响应式应用:
      </Paragraph>

      <Paragraph>
        <ul>
          <li>
            <strong>observable</strong>: 将 TodoStore 类实例转换为响应式对象,
            当对象属性变化时会自动通知观察者
          </li>
          <li>
            <strong>observer</strong>: 将 React 组件转换为响应式组件, 自动追踪组件中访问的
            observable 数据,并在数据变化时重新渲染
          </li>
          <li>
            <strong>计算属性</strong>: 使用 getter 定义计算属性(如 filteredTodos、activeCount),
            这些属性会自动缓存并在依赖变化时重新计算
          </li>
        </ul>
      </Paragraph>

      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <TodoInput />
        <TodoList />
        <TodoFooter />
      </Space>

      <Card title="核心代码示例" style={{ marginTop: 24 }}>
        <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 4, overflow: 'auto' }}>
          {`// 1. 创建 Store 类
class TodoStore {
  todos: Todo[] = [];
  filter: FilterType = 'all';

  addTodo(text: string) {
    this.todos.push({ id: Date.now(), text, completed: false });
  }

  toggleTodo(id: number) {
    const todo = this.todos.find(t => t.id === id);
    if (todo) todo.completed = !todo.completed;
  }

  // 计算属性 - 自动缓存和更新
  get filteredTodos() {
    return this.filter === 'all' 
      ? this.todos 
      : this.todos.filter(t => 
          this.filter === 'active' ? !t.completed : t.completed
        );
  }
}

// 2. 使用 observable 创建响应式实例
export const todoStore = observable(new TodoStore());

// 3. 使用 observer 创建响应式组件
const TodoList = observer(() => {
  // 自动追踪 filteredTodos 的访问
  return (
    <div>
      {todoStore.filteredTodos.map(todo => (
        <div key={todo.id}>
          <input 
            type="checkbox"
            checked={todo.completed}
            onChange={() => todoStore.toggleTodo(todo.id)}
          />
          {todo.text}
        </div>
      ))}
    </div>
  );
});`}
        </pre>
      </Card>

      <Card title="响应式原理" style={{ marginTop: 16 }}>
        <Paragraph>
          <ol>
            <li>
              <strong>依赖追踪</strong>: 当 observer 组件渲染时,会自动追踪组件中访问的所有
              observable 属性
            </li>
            <li>
              <strong>变更检测</strong>: 当 observable 对象的属性被修改时,会通知所有依赖该属性的组件
            </li>
            <li>
              <strong>精确更新</strong>: 只有真正依赖变化数据的组件才会重新渲染,避免不必要的渲染
            </li>
            <li>
              <strong>计算缓存</strong>: getter 定义的计算属性会自动缓存,只在依赖变化时重新计算
            </li>
          </ol>
        </Paragraph>
      </Card>
    </div>
  );
}
