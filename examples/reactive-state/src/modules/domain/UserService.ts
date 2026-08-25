/**
 * 用户服务 - 用于演示 useService 和 useObserverService
 *
 * 这个服务展示了如何在 Domain 中定义一个包含 observable 状态的服务
 * Service 基类会自动将所有属性转换为 observable，所有方法默认都是 Action
 *
 * 关键特性：
 * - 所有属性自动 observable，状态变化会自动触发响应
 * - 所有方法默认都是 Action，支持自动批量更新
 * - 异步方法会自动管理 loading 和 error 状态（通过 $model）
 * - 支持使用 @SyncAction 装饰器排除特定方法的批量更新
 */
import { Service } from '@rabjs/react';

export interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string;
}

export class UserService extends Service {
  currentUser: User | null = null;

  users: User[] = [
    { id: 1, name: 'Alice', email: 'alice@example.com', avatar: '👩' },
    { id: 2, name: 'Bob', email: 'bob@example.com', avatar: '👨' },
    { id: 3, name: 'Charlie', email: 'charlie@example.com', avatar: '👨‍🦱' },
  ];

  loading = false;

  error: string | null = null;

  /**
   * 新用户名输入框的值
   * 用于在添加用户时临时存储用户输入
   */
  newUserName: string = '';

  /**
   * 设置当前用户
   * 这个方法会自动被视为 Action，支持自动批量更新
   */
  setCurrentUser(user: User | null) {
    this.currentUser = user;
    this.error = null;
  }

  /**
   * 异步加载用户
   * 异步方法会自动管理 loading 和 error 状态
   * 可以通过 this.$model.loadUser 访问状态
   */
  async loadUser(userId: number) {
    this.loading = true;
    this.error = null;
    try {
      // 模拟异步加载
      await new Promise(resolve => setTimeout(resolve, 500));
      const user = this.users.find(u => u.id === userId);
      if (user) {
        this.currentUser = user;
      } else {
        this.error = `User with id ${userId} not found`;
      }
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Unknown error';
    } finally {
      this.loading = false;
    }
  }

  /**
   * 添加用户
   */
  addUser(user: User) {
    this.users.push(user);
  }

  /**
   * 删除用户
   */
  removeUser(userId: number) {
    this.users = this.users.filter(u => u.id !== userId);
    if (this.currentUser?.id === userId) {
      this.currentUser = null;
    }
  }

  /**
   * 更新用户信息
   */
  updateUser(userId: number, updates: Partial<User>) {
    const user = this.users.find(u => u.id === userId);
    if (user) {
      Object.assign(user, updates);
      if (this.currentUser?.id === userId) {
        this.currentUser = { ...this.currentUser, ...updates };
      }
    }
  }

  /**
   * 清除当前用户选择
   */
  clearCurrentUser() {
    this.currentUser = null;
  }

  /**
   * 获取用户总数
   * 这是一个纯计算方法，不会被视为 Action
   */
  getUserCount(): number {
    return this.users.length;
  }

  /**
   * 根据 ID 获取用户
   * 这是一个纯查询方法，不会被视为 Action
   */
  getUserById(id: number): User | undefined {
    return this.users.find(u => u.id === id);
  }

  /**
   * 设置新用户名
   * 用于更新输入框的值
   */
  setNewUserName(name: string) {
    this.newUserName = name;
  }

  /**
   * 添加新用户
   * 根据当前的 newUserName 创建并添加新用户，然后清空输入框
   */
  addNewUser() {
    if (this.newUserName.trim()) {
      const newUser: User = {
        id: Math.max(...this.users.map((u: User) => u.id), 0) + 1,
        name: this.newUserName,
        email: `${this.newUserName.toLowerCase()}@example.com`,
        avatar: '👤',
      };
      this.addUser(newUser);
      this.newUserName = '';
    }
  }

  /**
   * 清空新用户名输入框
   */
  clearNewUserName() {
    this.newUserName = '';
  }
}
