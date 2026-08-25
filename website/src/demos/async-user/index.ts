import UserDemo from './UserDemo';

export default UserDemo;
export { UserService } from './UserService';

/**
 * 与 live demo 对应的展示源码（DemoCard 的 code 属性使用）。
 * 内容约定：改动 UserService / UserDemo 时同步更新这里的字符串。
 */
export const asyncUserDemoCode = `import { Service } from "@rabjs/react";
import { bindServices, observer, useService } from "@rabjs/react";

interface Profile {
  id: number;
  name: string;
  bio: string;
}

const MOCK_DB: Record<number, Profile> = {
  1: { id: 1, name: "Alice", bio: "响应式爱好者" },
  2: { id: 2, name: "Bob", bio: "Service 容器重度用户" },
};

// 1. 定义 Service：async 方法的 loading / error 由基类自动维护
class UserService extends Service {
  profile: Profile | null = null;

  async loadUser(id: number) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    const user = MOCK_DB[id];
    if (!user) throw new Error(\`用户 \${id} 不存在\`);
    this.profile = user;
    return user;
  }
}

// 2. $model.loadUser 直接渲染 loading / error
const User = observer(() => {
  const user = useService(UserService);
  const { loading, error } = user.$model.loadUser;
  return (
    <div>
      <button onClick={() => user.loadUser(1).catch(() => {})}>加载 Alice</button>
      {loading && <p>加载中…</p>}
      {error && <p>出错了：{error.message}</p>}
      {!loading && user.profile && <p>{user.profile.name}</p>}
    </div>
  );
});

// 3. bindServices 提供服务容器
export default bindServices(User, [UserService]);
`;
