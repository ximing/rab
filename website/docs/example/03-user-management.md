# 案例 3：用户管理系统（复杂示例）

这个案例展示了一个完整的企业级应用，涉及异步操作、多个 Service 的依赖注入、错误处理和加载状态管理。

## 场景描述

实现一个用户管理系统，支持：

- 从 API 获取用户列表
- 搜索和筛选用户
- 创建、编辑、删除用户
- 自动的 loading 和 error 状态管理
- 多个 Service 之间的依赖注入

## 完整代码

### 1. 定义数据模型和 API 类型

```typescript
// types/user.ts
export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  department: string;
  role: 'admin' | 'user' | 'guest';
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export interface UserFilter {
  search?: string;
  department?: string;
  role?: string;
  status?: string;
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}
```

### 2. 创建 API Service

```typescript
// services/UserApiService.ts
import { Service } from '@rabjs/react';
import { User, UserFilter, ApiResponse } from '../types/user';

export class UserApiService extends Service {
  // 模拟 API 基础 URL
  private baseUrl = '/api/users';

  // 获取用户列表
  async fetchUsers(filter?: UserFilter): Promise<User[]> {
    // 模拟 API 调用
    const params = new URLSearchParams();
    if (filter?.search) params.append('search', filter.search);
    if (filter?.department) params.append('department', filter.department);
    if (filter?.role) params.append('role', filter.role);
    if (filter?.status) params.append('status', filter.status);

    const response = await fetch(`${this.baseUrl}?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch users: ${response.statusText}`);
    }
    const data: ApiResponse<User[]> = await response.json();
    return data.data;
  }

  // 获取单个用户
  async fetchUser(id: string): Promise<User> {
    const response = await fetch(`${this.baseUrl}/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch user: ${response.statusText}`);
    }
    const data: ApiResponse<User> = await response.json();
    return data.data;
  }

  // 创建用户
  async createUser(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    if (!response.ok) {
      throw new Error(`Failed to create user: ${response.statusText}`);
    }
    const data: ApiResponse<User> = await response.json();
    return data.data;
  }

  // 更新用户
  async updateUser(id: string, user: Partial<User>): Promise<User> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    if (!response.ok) {
      throw new Error(`Failed to update user: ${response.statusText}`);
    }
    const data: ApiResponse<User> = await response.json();
    return data.data;
  }

  // 删除用户
  async deleteUser(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`Failed to delete user: ${response.statusText}`);
    }
  }
}
```

### 3. 创建业务逻辑 Service

```typescript
// services/UserService.ts
import { Service, Inject } from '@rabjs/react';
import { User, UserFilter } from '../types/user';
import { UserApiService } from './UserApiService';

export class UserService extends Service {
  // 依赖注入
  @Inject()
  private apiService!: UserApiService;

  // 状态
  users: User[] = [];
  filter: UserFilter = {};
  selectedUserId: string | null = null;
  editingUserId: string | null = null;

  // 计算属性
  get selectedUser(): User | undefined {
    return this.users.find(u => u.id === this.selectedUserId);
  }

  get editingUser(): User | undefined {
    return this.users.find(u => u.id === this.editingUserId);
  }

  get filteredUsers(): User[] {
    return this.users.filter(user => {
      if (this.filter.search) {
        const search = this.filter.search.toLowerCase();
        if (
          !user.name.toLowerCase().includes(search) &&
          !user.email.toLowerCase().includes(search)
        ) {
          return false;
        }
      }
      if (this.filter.department && user.department !== this.filter.department) {
        return false;
      }
      if (this.filter.role && user.role !== this.filter.role) {
        return false;
      }
      if (this.filter.status && user.status !== this.filter.status) {
        return false;
      }
      return true;
    });
  }

  get stats() {
    return {
      total: this.users.length,
      active: this.users.filter(u => u.status === 'active').length,
      inactive: this.users.filter(u => u.status === 'inactive').length,
      admins: this.users.filter(u => u.role === 'admin').length,
    };
  }

  // 方法
  async loadUsers() {
    try {
      this.users = await this.apiService.fetchUsers(this.filter);
    } catch (error) {
      console.error('Failed to load users:', error);
      throw error;
    }
  }

  async createUser(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
      const newUser = await this.apiService.createUser(user);
      this.users.push(newUser);
      return newUser;
    } catch (error) {
      console.error('Failed to create user:', error);
      throw error;
    }
  }

  async updateUser(id: string, updates: Partial<User>) {
    try {
      const updatedUser = await this.apiService.updateUser(id, updates);
      const index = this.users.findIndex(u => u.id === id);
      if (index !== -1) {
        this.users[index] = updatedUser;
      }
      this.editingUserId = null;
      return updatedUser;
    } catch (error) {
      console.error('Failed to update user:', error);
      throw error;
    }
  }

  async deleteUser(id: string) {
    try {
      await this.apiService.deleteUser(id);
      this.users = this.users.filter(u => u.id !== id);
      if (this.selectedUserId === id) {
        this.selectedUserId = null;
      }
      if (this.editingUserId === id) {
        this.editingUserId = null;
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      throw error;
    }
  }

  setFilter(filter: UserFilter) {
    this.filter = filter;
  }

  selectUser(id: string) {
    this.selectedUserId = id;
  }

  startEditing(id: string) {
    this.editingUserId = id;
  }

  cancelEditing() {
    this.editingUserId = null;
  }
}
```

### 4. 创建 React 组件

```typescript
// components/UserManagement.tsx
import React, { useEffect, useState } from 'react';
import { observer, useService, bindServices } from '@rabjs/react';
import { UserService } from '../services/UserService';
import { UserApiService } from '../services/UserApiService';
import { User, UserFilter } from '../types/user';
import './UserManagement.css';

// 用户列表项组件
const UserListItem = observer(({ userId }: { userId: string }) => {
  const service = useService(UserService);
  const user = service.users.find(u => u.id === userId);

  if (!user) return null;

  const isSelected = service.selectedUserId === userId;
  const isEditing = service.editingUserId === userId;

  return (
    <div
      className={`user-item ${isSelected ? 'selected' : ''}`}
      onClick={() => service.selectUser(userId)}
    >
      <div className="user-info">
        <div className="user-name">{user.name}</div>
        <div className="user-email">{user.email}</div>
        <div className="user-meta">
          <span className={`badge badge-${user.role}`}>{user.role}</span>
          <span className={`badge badge-${user.status}`}>
            {user.status === 'active' ? '活跃' : '非活跃'}
          </span>
          <span className="user-department">{user.department}</span>
        </div>
      </div>
      <div className="user-actions">
        <button
          onClick={e => {
            e.stopPropagation();
            service.startEditing(userId);
          }}
          className="btn btn-small"
        >
          编辑
        </button>
        <button
          onClick={e => {
            e.stopPropagation();
            service.deleteUser(userId);
          }}
          className="btn btn-small btn-danger"
        >
          删除
        </button>
      </div>
    </div>
  );
});

// 用户编辑表单组件
const UserEditForm = observer(({ userId }: { userId: string }) => {
  const service = useService(UserService);
  const user = service.users.find(u => u.id === userId);
  const [formData, setFormData] = useState<Partial<User>>(user || {});

  if (!user) return null;

  const handleSubmit = async () => {
    try {
      await service.updateUser(userId, formData);
    } catch (error) {
      alert('更新失败，请重试');
    }
  };

  return (
    <div className="edit-form">
      <h3>编辑用户</h3>
      <div className="form-group">
        <label>姓名</label>
        <input
          type="text"
          value={formData.name || ''}
          onChange={e => setFormData({ ...formData, name: e.target.value })}
        />
      </div>
      <div className="form-group">
        <label>邮箱</label>
        <input
          type="email"
          value={formData.email || ''}
          onChange={e => setFormData({ ...formData, email: e.target.value })}
        />
      </div>
      <div className="form-group">
        <label>部门</label>
        <input
          type="text"
          value={formData.department || ''}
          onChange={e => setFormData({ ...formData, department: e.target.value })}
        />
      </div>
      <div className="form-group">
        <label>角色</label>
        <select
          value={formData.role || 'user'}
          onChange={e => setFormData({ ...formData, role: e.target.value as any })}
        >
          <option value="admin">管理员</option>
          <option value="user">用户</option>
          <option value="guest">访客</option>
        </select>
      </div>
      <div className="form-actions">
        <button onClick={handleSubmit} className="btn btn-primary">
          保存
        </button>
        <button onClick={() => service.cancelEditing()} className="btn btn-secondary">
          取消
        </button>
      </div>
    </div>
  );
});

// 主组件
const UserManagementContent = observer(() => {
  const service = useService(UserService);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');

  // 初始化加载用户列表
  useEffect(() => {
    const loadUsers = async () => {
      setLoading(true);
      setError(null);
      try {
        await service.loadUsers();
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setLoading(false);
      }
    };
    loadUsers();
  }, [service]);

  const handleSearch = () => {
    service.setFilter({ ...service.filter, search: searchText });
  };

  return (
    <div className="user-management">
      <h1>用户管理系统</h1>

      {/* 统计信息 */}
      <div className="stats">
        <div className="stat-item">
          <span className="stat-label">总用户数</span>
          <span className="stat-value">{service.stats.total}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">活跃用户</span>
          <span className="stat-value">{service.stats.active}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">非活跃用户</span>
          <span className="stat-value">{service.stats.inactive}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">管理员</span>
          <span className="stat-value">{service.stats.admins}</span>
        </div>
      </div>

      {/* 搜索和筛选 */}
      <div className="search-bar">
        <input
          type="text"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && handleSearch()}
          placeholder="搜索用户名或邮箱..."
          className="search-input"
        />
        <button onClick={handleSearch} className="btn btn-primary">
          搜索
        </button>
      </div>

      {/* 错误提示 */}
      {error && <div className="error-message">{error}</div>}

      {/* 加载状态 */}
      {loading && <div className="loading">加载中...</div>}

      {/* 用户列表 */}
      {!loading && (
        <div className="user-list-container">
          <div className="user-list">
            {service.filteredUsers.length > 0 ? (
              service.filteredUsers.map(user => <UserListItem key={user.id} userId={user.id} />)
            ) : (
              <div className="empty-state">
                {service.users.length === 0 ? '暂无用户' : '没有匹配的用户'}
              </div>
            )}
          </div>

          {/* 用户详情和编辑 */}
          {service.editingUserId && <UserEditForm userId={service.editingUserId} />}
          {service.selectedUserId && !service.editingUserId && (
            <div className="user-detail">
              <h3>用户详情</h3>
              {service.selectedUser && (
                <div className="detail-content">
                  <p>
                    <strong>姓名：</strong> {service.selectedUser.name}
                  </p>
                  <p>
                    <strong>邮箱：</strong> {service.selectedUser.email}
                  </p>
                  <p>
                    <strong>部门：</strong> {service.selectedUser.department}
                  </p>
                  <p>
                    <strong>角色：</strong> {service.selectedUser.role}
                  </p>
                  <p>
                    <strong>状态：</strong>{' '}
                    {service.selectedUser.status === 'active' ? '活跃' : '非活跃'}
                  </p>
                  <p>
                    <strong>创建时间：</strong>{' '}
                    {new Date(service.selectedUser.createdAt).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default bindServices(UserManagementContent, [UserService, UserApiService]);
```

### 5. 样式文件

```css
/* components/UserManagement.css */
.user-management {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 15px;
  margin: 20px 0;
}

.stat-item {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
}

.stat-label {
  display: block;
  font-size: 12px;
  opacity: 0.9;
  margin-bottom: 8px;
}

.stat-value {
  display: block;
  font-size: 28px;
  font-weight: bold;
}

.search-bar {
  display: flex;
  gap: 10px;
  margin: 20px 0;
}

.search-input {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.error-message {
  background: #f8d7da;
  color: #721c24;
  padding: 12px;
  border-radius: 4px;
  margin: 10px 0;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #666;
}

.user-list-container {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 20px;
  margin: 20px 0;
}

.user-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.user-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background: white;
  border: 1px solid #eee;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.user-item:hover {
  background: #f9f9f9;
  border-color: #ddd;
}

.user-item.selected {
  background: #e7f3ff;
  border-color: #667eea;
}

.user-info {
  flex: 1;
}

.user-name {
  font-weight: 500;
  margin-bottom: 5px;
}

.user-email {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
}

.user-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.badge-admin {
  background: #ffeaa7;
  color: #d63031;
}

.badge-user {
  background: #dfe6e9;
  color: #2d3436;
}

.badge-guest {
  background: #fab1a0;
  color: #d63031;
}

.badge-active {
  background: #55efc4;
  color: #00b894;
}

.badge-inactive {
  background: #fd79a8;
  color: #e84393;
}

.user-department {
  font-size: 12px;
  color: #999;
}

.user-actions {
  display: flex;
  gap: 5px;
}

.btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover {
  background: #5568d3;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #5a6268;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover {
  background: #c82333;
}

.btn-small {
  padding: 4px 8px;
  font-size: 12px;
}

.edit-form,
.user-detail {
  background: white;
  padding: 20px;
  border-radius: 4px;
  border: 1px solid #eee;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  font-size: 14px;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.detail-content p {
  margin: 10px 0;
  font-size: 14px;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #999;
}

@media (max-width: 768px) {
  .user-list-container {
    grid-template-columns: 1fr;
  }
}
```

## 关键特性

✅ **异步操作**：自动的 loading 和 error 状态管理  
✅ **依赖注入**：多个 Service 之间的依赖关系  
✅ **复杂业务逻辑**：搜索、筛选、分页等功能  
✅ **错误处理**：完整的错误处理和用户提示  
✅ **性能优化**：细粒度更新，避免不必要的重新渲染  
✅ **企业级架构**：清晰的分层设计（API Service、业务 Service、UI 组件）

## 工作原理

1. **Service 分层**：

   - `UserApiService`：处理 API 调用
   - `UserService`：处理业务逻辑和状态管理

2. **依赖注入**：`UserService` 通过 `@Inject()` 装饰器注入 `UserApiService`

3. **异步操作**：Service 中的异步方法自动管理 loading 和 error 状态

4. **细粒度更新**：组件只追踪实际访问的属性，避免不必要的重新渲染

## 下一步

- 查看 [组件+Service 新封装案例](./04-component-service-wrapper.md) 了解如何创建可复用的组件+Service 组合
