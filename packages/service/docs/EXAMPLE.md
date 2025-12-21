# Service 使用示例

## 基础示例

### 1. 配置应用（入口文件）

```typescript
// src/index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { unstable_batchedUpdates } from 'react-dom';
import { configureServiceForReact } from '@rabjs/react';
import App from './App';

// 配置 Service 使用 React 批量更新
configureServiceForReact(unstable_batchedUpdates);

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
```

### 2. 定义 Service

```typescript
// src/services/UserService.ts
import { Service } from '@rabjs/service';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export class UserService extends Service {
  // 响应式状态
  users: User[] = [];
  currentUser: User | null = null;
  searchQuery: string = '';

  // 异步方法 - 自动管理 loading 和 error
  async fetchUsers() {
    const response = await fetch('/api/users');
    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }
    this.users = await response.json();
    return this.users;
  }

  async fetchUser(id: string) {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch user');
    }
    this.currentUser = await response.json();
    return this.currentUser;
  }

  async updateUser(id: string, data: Partial<User>) {
    const response = await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error('Failed to update user');
    }
    const updatedUser = await response.json();

    // 更新本地状态
    const index = this.users.findIndex(u => u.id === id);
    if (index !== -1) {
      this.users[index] = updatedUser;
    }
    if (this.currentUser?.id === id) {
      this.currentUser = updatedUser;
    }

    return updatedUser;
  }

  async deleteUser(id: string) {
    const response = await fetch(`/api/users/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete user');
    }

    // 从列表中移除
    this.users = this.users.filter(u => u.id !== id);
    if (this.currentUser?.id === id) {
      this.currentUser = null;
    }
  }

  // 同步方法
  setSearchQuery(query: string) {
    this.searchQuery = query;
  }

  clearSearch() {
    this.searchQuery = '';
  }

  // 计算属性（使用 getter）
  get filteredUsers() {
    if (!this.searchQuery) {
      return this.users;
    }
    const query = this.searchQuery.toLowerCase();
    return this.users.filter(
      user => user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query)
    );
  }

  get hasUsers() {
    return this.users.length > 0;
  }
}
```

### 3. 在组件中使用

```typescript
// src/components/UserList.tsx
import React, { useEffect, useMemo } from 'react';
import { observer } from '@rabjs/react';
import { UserService } from '../services/UserService';

export const UserList = observer(() => {
  // 创建 Service 实例（使用 useMemo 确保实例稳定）
  const userService = useMemo(() => new UserService(), []);

  // 组件挂载时获取数据
  useEffect(() => {
    userService.fetchUsers();
  }, [userService]);

  // 访问 loading 和 error 状态
  const { loading, error } = userService.$model.fetchUsers;

  // 处理删除
  const handleDelete = async (id: string) => {
    if (confirm('确定要删除这个用户吗？')) {
      try {
        await userService.deleteUser(id);
      } catch (error) {
        alert('删除失败：' + (error as Error).message);
      }
    }
  };

  // 渲染加载状态
  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <p>加载中...</p>
      </div>
    );
  }

  // 渲染错误状态
  if (error) {
    return (
      <div className="error">
        <p>加载失败：{error.message}</p>
        <button onClick={() => userService.fetchUsers()}>重试</button>
      </div>
    );
  }

  // 渲染用户列表
  return (
    <div className="user-list">
      <div className="search-bar">
        <input
          type="text"
          placeholder="搜索用户..."
          value={userService.searchQuery}
          onChange={e => userService.setSearchQuery(e.target.value)}
        />
        {userService.searchQuery && <button onClick={() => userService.clearSearch()}>清除</button>}
      </div>

      {!userService.hasUsers ? (
        <p className="empty">暂无用户</p>
      ) : (
        <ul>
          {userService.filteredUsers.map(user => (
            <li key={user.id} className="user-item">
              {user.avatar && <img src={user.avatar} alt={user.name} />}
              <div className="user-info">
                <h3>{user.name}</h3>
                <p>{user.email}</p>
              </div>
              <div className="user-actions">
                <button onClick={() => handleDelete(user.id)}>
                  {userService.$model.deleteUser.loading ? '删除中...' : '删除'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
```

## 高级示例

### 1. 使用 Context 共享 Service

```typescript
// src/contexts/UserServiceContext.tsx
import React, { createContext, useContext, useMemo } from 'react';
import { UserService } from '../services/UserService';

const UserServiceContext = createContext<UserService | null>(null);

export const UserServiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const userService = useMemo(() => new UserService(), []);

  return <UserServiceContext.Provider value={userService}>{children}</UserServiceContext.Provider>;
};

export const useUserService = () => {
  const service = useContext(UserServiceContext);
  if (!service) {
    throw new Error('useUserService must be used within UserServiceProvider');
  }
  return service;
};
```

```typescript
// src/App.tsx
import React from 'react';
import { UserServiceProvider } from './contexts/UserServiceContext';
import { UserList } from './components/UserList';
import { UserDetail } from './components/UserDetail';

export const App = () => {
  return (
    <UserServiceProvider>
      <div className="app">
        <UserList />
        <UserDetail />
      </div>
    </UserServiceProvider>
  );
};
```

```typescript
// src/components/UserList.tsx
import React, { useEffect } from 'react';
import { observer } from '@rabjs/react';
import { useUserService } from '../contexts/UserServiceContext';

export const UserList = observer(() => {
  const userService = useUserService();

  useEffect(() => {
    userService.fetchUsers();
  }, [userService]);

  // ... 其他代码
});
```

### 2. Service 组合

```typescript
// src/services/TodoService.ts
import { Service } from '@rabjs/service';

export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  userId: string;
}

export class TodoService extends Service {
  todos: Todo[] = [];
  filter: 'all' | 'active' | 'completed' = 'all';

  async fetchTodos(userId: string) {
    const response = await fetch(`/api/users/${userId}/todos`);
    this.todos = await response.json();
    return this.todos;
  }

  async addTodo(userId: string, text: string) {
    const response = await fetch(`/api/users/${userId}/todos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const newTodo = await response.json();
    this.todos.push(newTodo);
    return newTodo;
  }

  async toggleTodo(id: string) {
    const todo = this.todos.find(t => t.id === id);
    if (!todo) return;

    const response = await fetch(`/api/todos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !todo.completed }),
    });
    const updatedTodo = await response.json();

    const index = this.todos.findIndex(t => t.id === id);
    if (index !== -1) {
      this.todos[index] = updatedTodo;
    }
  }

  setFilter(filter: 'all' | 'active' | 'completed') {
    this.filter = filter;
  }

  get filteredTodos() {
    switch (this.filter) {
      case 'active':
        return this.todos.filter(t => !t.completed);
      case 'completed':
        return this.todos.filter(t => t.completed);
      default:
        return this.todos;
    }
  }

  get stats() {
    return {
      total: this.todos.length,
      active: this.todos.filter(t => !t.completed).length,
      completed: this.todos.filter(t => t.completed).length,
    };
  }
}
```

```typescript
// src/components/UserDashboard.tsx
import React, { useEffect, useMemo } from 'react';
import { observer } from '@rabjs/react';
import { UserService } from '../services/UserService';
import { TodoService } from '../services/TodoService';

export const UserDashboard = observer(({ userId }: { userId: string }) => {
  const userService = useMemo(() => new UserService(), []);
  const todoService = useMemo(() => new TodoService(), []);

  useEffect(() => {
    userService.fetchUser(userId);
    todoService.fetchTodos(userId);
  }, [userId, userService, todoService]);

  const user = userService.currentUser;
  const { loading: userLoading } = userService.$model.fetchUser;
  const { loading: todosLoading } = todoService.$model.fetchTodos;

  if (userLoading || todosLoading) {
    return <div>加载中...</div>;
  }

  if (!user) {
    return <div>用户不存在</div>;
  }

  return (
    <div className="dashboard">
      <div className="user-header">
        <h1>{user.name}</h1>
        <p>{user.email}</p>
      </div>

      <div className="todo-stats">
        <div>总计: {todoService.stats.total}</div>
        <div>进行中: {todoService.stats.active}</div>
        <div>已完成: {todoService.stats.completed}</div>
      </div>

      <div className="todo-filters">
        <button
          className={todoService.filter === 'all' ? 'active' : ''}
          onClick={() => todoService.setFilter('all')}
        >
          全部
        </button>
        <button
          className={todoService.filter === 'active' ? 'active' : ''}
          onClick={() => todoService.setFilter('active')}
        >
          进行中
        </button>
        <button
          className={todoService.filter === 'completed' ? 'active' : ''}
          onClick={() => todoService.setFilter('completed')}
        >
          已完成
        </button>
      </div>

      <ul className="todo-list">
        {todoService.filteredTodos.map(todo => (
          <li key={todo.id}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={() => todoService.toggleTodo(todo.id)}
            />
            <span className={todo.completed ? 'completed' : ''}>{todo.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
});
```

### 3. 表单处理

```typescript
// src/services/UserFormService.ts
import { Service } from '@rabjs/service';
import { UserService, User } from './UserService';

export class UserFormService extends Service {
  name: string = '';
  email: string = '';
  avatar: string = '';

  errors: {
    name?: string;
    email?: string;
  } = {};

  constructor(private userService: UserService) {
    super();
  }

  setName(name: string) {
    this.name = name;
    this.validateName();
  }

  setEmail(email: string) {
    this.email = email;
    this.validateEmail();
  }

  setAvatar(avatar: string) {
    this.avatar = avatar;
  }

  validateName() {
    if (!this.name.trim()) {
      this.errors.name = '姓名不能为空';
    } else if (this.name.length < 2) {
      this.errors.name = '姓名至少2个字符';
    } else {
      delete this.errors.name;
    }
  }

  validateEmail() {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!this.email.trim()) {
      this.errors.email = '邮箱不能为空';
    } else if (!emailRegex.test(this.email)) {
      this.errors.email = '邮箱格式不正确';
    } else {
      delete this.errors.email;
    }
  }

  get isValid() {
    return Object.keys(this.errors).length === 0 && this.name && this.email;
  }

  async submit() {
    this.validateName();
    this.validateEmail();

    if (!this.isValid) {
      throw new Error('表单验证失败');
    }

    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: this.name,
        email: this.email,
        avatar: this.avatar,
      }),
    });

    if (!response.ok) {
      throw new Error('创建用户失败');
    }

    const newUser = await response.json();

    // 更新 UserService 的状态
    this.userService.users.push(newUser);

    // 重置表单
    this.reset();

    return newUser;
  }

  reset() {
    this.name = '';
    this.email = '';
    this.avatar = '';
    this.errors = {};
  }

  loadUser(user: User) {
    this.name = user.name;
    this.email = user.email;
    this.avatar = user.avatar || '';
  }
}
```

```typescript
// src/components/UserForm.tsx
import React, { useMemo } from 'react';
import { observer } from '@rabjs/react';
import { useUserService } from '../contexts/UserServiceContext';
import { UserFormService } from '../services/UserFormService';

export const UserForm = observer(() => {
  const userService = useUserService();
  const formService = useMemo(() => new UserFormService(userService), [userService]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await formService.submit();
      alert('用户创建成功！');
    } catch (error) {
      alert('创建失败：' + (error as Error).message);
    }
  };

  const { loading, error } = formService.$model.submit;

  return (
    <form onSubmit={handleSubmit} className="user-form">
      <div className="form-group">
        <label htmlFor="name">姓名</label>
        <input
          id="name"
          type="text"
          value={formService.name}
          onChange={e => formService.setName(e.target.value)}
          className={formService.errors.name ? 'error' : ''}
        />
        {formService.errors.name && (
          <span className="error-message">{formService.errors.name}</span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="email">邮箱</label>
        <input
          id="email"
          type="email"
          value={formService.email}
          onChange={e => formService.setEmail(e.target.value)}
          className={formService.errors.email ? 'error' : ''}
        />
        {formService.errors.email && (
          <span className="error-message">{formService.errors.email}</span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="avatar">头像 URL</label>
        <input
          id="avatar"
          type="url"
          value={formService.avatar}
          onChange={e => formService.setAvatar(e.target.value)}
        />
      </div>

      {error && <div className="form-error">{error.message}</div>}

      <div className="form-actions">
        <button type="button" onClick={() => formService.reset()}>
          重置
        </button>
        <button type="submit" disabled={!formService.isValid || loading}>
          {loading ? '提交中...' : '提交'}
        </button>
      </div>
    </form>
  );
});
```

## React Native 示例

```typescript
// App.tsx (React Native)
import React from 'react';
import { unstable_batchedUpdates } from 'react-native';
import { configureServiceForReact } from '@rabjs/react';
import { UserList } from './components/UserList';

// 配置 Service 使用 React Native 批量更新
configureServiceForReact(unstable_batchedUpdates);

export default function App() {
  return <UserList />;
}
```

```typescript
// components/UserList.tsx (React Native)
import React, { useEffect, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { observer } from '@rabjs/react';
import { UserService } from '../services/UserService';

export const UserList = observer(() => {
  const userService = useMemo(() => new UserService(), []);

  useEffect(() => {
    userService.fetchUsers();
  }, [userService]);

  const { loading, error } = userService.$model.fetchUsers;

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
        <Text>加载中...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>加载失败：{error.message}</Text>
        <TouchableOpacity onPress={() => userService.fetchUsers()}>
          <Text>重试</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={userService.users}
      keyExtractor={item => item.id}
      renderItem={({ item }) => (
        <View style={{ padding: 16, borderBottomWidth: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{item.name}</Text>
          <Text style={{ color: '#666' }}>{item.email}</Text>
        </View>
      )}
    />
  );
});
```

## 总结

这些示例展示了 `@rabjs/service` 的核心用法：

1. **配置批量更新**：在应用入口配置 React 批量更新
2. **定义 Service**：继承 Service 类，定义响应式状态和方法
3. **在组件中使用**：使用 `observer` 包裹组件，使用 `useMemo` 创建 Service 实例
4. **访问状态**：通过 `$model` 访问方法的 loading 和 error 状态
5. **Service 组合**：多个 Service 可以组合使用
6. **Context 共享**：使用 React Context 在多个组件间共享 Service
7. **表单处理**：Service 可以很好地处理表单状态和验证

所有这些都是类型安全的，并且具有完整的 TypeScript 支持！
