/**
 * 用户 Store - 用于演示 useAsObservableSource
 */
import { observable } from '@rabjs/react';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

export class UserStore {
  currentUser: User | null = null;
  users: User[] = [
    { id: 1, name: '张三', email: 'zhangsan@example.com', role: 'admin' },
    { id: 2, name: '李四', email: 'lisi@example.com', role: 'user' },
    { id: 3, name: '王五', email: 'wangwu@example.com', role: 'user' },
  ];

  setCurrentUser(user: User | null) {
    this.currentUser = user;
  }

  updateUser(id: number, updates: Partial<User>) {
    const user = this.users.find(u => u.id === id);
    if (user) {
      Object.assign(user, updates);
    }
  }
}

export const userStore = observable(new UserStore());
