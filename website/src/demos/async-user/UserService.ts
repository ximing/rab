import { Service } from "@rabjs/react";

export interface Profile {
  id: number;
  name: string;
  bio: string;
}

const MOCK_DB: Record<number, Profile> = {
  1: { id: 1, name: "Alice", bio: "响应式爱好者" },
  2: { id: 2, name: "Bob", bio: "Service 容器重度用户" },
};

/**
 * 异步加载 Service —— $model 状态演示
 *
 * Service 基类会为每个方法自动维护 $model.<method> = { loading, error }：
 * - 异步方法调用时 loading 立即置 true，结束（无论成败）置 false；
 * - reject 的 error 会写入 error 字段，同时继续向上抛出；
 * - $model 本身也是响应式的，可以直接在 observer 组件里渲染。
 */
export class UserService extends Service {
  profile: Profile | null = null;

  async loadUser(id: number) {
    // 模拟远程请求
    await new Promise((resolve) => setTimeout(resolve, 600));
    const user = MOCK_DB[id];
    if (!user) throw new Error(`用户 ${id} 不存在`);
    this.profile = user;
    return user;
  }
}
