# 异步操作和状态追踪

## 自动的 Loading 和 Error 状态

Service 会自动为所有异步方法创建 `loading` 和 `error` 状态，通过 `$model` 访问：

```typescript
import { Service } from "@rabjs/react";

export class UserService extends Service {
  users: any[] = [];
  currentUser: any = null;

  async fetchUsers() {
    const response = await fetch("/api/users");
    this.users = await response.json();
  }

  async fetchUserById(id: string) {
    const response = await fetch(`/api/users/${id}`);
    this.currentUser = await response.json();
  }
}

// 在组件中使用
import { observer, useService, bindServices } from "@rabjs/react";

const UserListContent = observer(() => {
  const service = useService(UserService);

  return (
    <div>
      <button onClick={() => service.fetchUsers()}>
        {service.$model.fetchUsers.loading ? "加载中..." : "加载用户"}
      </button>

      {service.$model.fetchUsers.error && (
        <p style={{ color: "red" }}>
          错误: {service.$model.fetchUsers.error.message}
        </p>
      )}

      <ul>
        {service.users.map((user) => (
          <li key={user.id}>
            {user.name}
            <button onClick={() => service.fetchUserById(user.id)}>
              查看详情
            </button>
          </li>
        ))}
      </ul>

      {service.currentUser && (
        <div>
          <h2>{service.currentUser.name}</h2>
          <p>邮箱: {service.currentUser.email}</p>
        </div>
      )}
    </div>
  );
});

export default bindServices(UserListContent, [UserService]);
```

## $model 对象结构

```typescript
service.$model.methodName = {
  loading: boolean, // 是否正在加载
  error: Error | null, // 错误对象（如果有）
};
```

`loading` / `error` 都是按方法名各一份的**最近一次写入**，不是 pending 计数。同一方法重叠调用时，先结束的那次会把 `loading` 提前打成 `false`；`error` 也无法对应到具体哪一次（成功与失败交错时语义含糊）。框架不会改成计数——加计数也消除不了 `error` 的二义性。请保证同一方法同时只跑一次；需要并发时自行追踪，不要读 `$model` 当队列。

## 常见模式

### 模式 1：加载状态显示

```typescript
const Component = observer(() => {
  const service = useService(DataService);

  if (service.$model.loadData.loading) {
    return <Spinner />;
  }

  return <div>{service.data}</div>;
});
```

### 模式 2：错误处理

```typescript
const Component = observer(() => {
  const service = useService(DataService);

  if (service.$model.loadData.error) {
    return (
      <ErrorMessage>
        {service.$model.loadData.error.message}
      </ErrorMessage>
    );
  }

  return <div>{service.data}</div>;
});
```

### 模式 3：组合状态

```typescript
const Component = observer(() => {
  const service = useService(DataService);
  const { loading, error } = service.$model.loadData;

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;

  return <DataDisplay data={service.data} />;
});
```

## 陷阱：异步回调中修改状态

```typescript
// ❌ 可能的问题：异步回调中修改状态
const Counter = observer(() => {
  const service = useService(CounterService);

  useEffect(() => {
    setTimeout(() => {
      service.count++; // 可能在组件卸载后执行
    }, 1000);
  }, []);

  return <div>{service.count}</div>;
});

// ✅ 更好：在 Service 中处理异步逻辑
class CounterService extends Service {
  count = 0;

  async incrementAfterDelay() {
    await new Promise(resolve => setTimeout(resolve, 1000));
    this.count++;
  }
}

const Counter = observer(() => {
  const service = useService(CounterService);

  useEffect(() => {
    service.incrementAfterDelay();
  }, [service]);

  return <div>{service.count}</div>;
});
```
