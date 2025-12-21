# 案例集合

欢迎来到 RSJS 完整案例集合！这里包含了从简单到复杂的实战案例，以及新的组件+Service 封装模式。

## 📚 案例导航

### 🟢 初级案例

#### [案例 1：简单计数器](./01-simple-counter.md)

**难度**: ⭐ 简单  
**学习时间**: 5 分钟

最基础的 RSJS 使用案例，展示了：

- 如何创建一个基础的 Service
- 如何在 React 组件中使用 Service
- 如何使用 `observer` 和 `bindServices`

**适合人群**: 初学者，刚开始接触 RSJS

**核心概念**:

- Service 定义
- observer HOC
- useService Hook
- bindServices 注册

---

### 🟡 中级案例

#### [案例 2：待办事项列表](./02-todo-list.md)

**难度**: ⭐⭐ 中等  
**学习时间**: 15 分钟

功能完整的待办事项管理系统，展示了：

- 复杂的状态管理
- 列表的 CRUD 操作
- 计算属性和筛选
- 嵌套组件中的 Service 使用

**适合人群**: 有一定 React 基础，想了解更复杂的状态管理

**核心概念**:

- 复杂状态结构
- 计算属性
- 列表操作
- 细粒度更新

---

### 🔴 高级案例

#### [案例 3：用户管理系统](./03-user-management.md)

**难度**: ⭐⭐⭐ 复杂  
**学习时间**: 30 分钟

企业级应用示例，展示了：

- 异步操作和 API 集成
- 多个 Service 的依赖注入
- 自动的 loading 和 error 状态管理
- 完整的错误处理和用户提示

**适合人群**: 有 React 和异步编程经验，想构建企业级应用

**核心概念**:

- 异步操作
- 依赖注入
- Service 分层
- 错误处理
- 加载状态管理

---

### 🚀 新模式案例

#### [案例 4：组件+Service 新封装模式](./04-component-service-wrapper.md)

**难度**: ⭐⭐⭐ 复杂  
**学习时间**: 30 分钟

展示了一种新的、更优雅的组件+Service 封装模式，包括：

- 创建可复用的组件+Service 组合
- 使用工厂函数简化 API
- 实现通用的数据表格组件
- 提供灵活的自定义选项

**适合人群**: 想构建可复用组件库，提高代码质量

**核心概念**:

- 工厂函数模式
- 泛型编程
- 高阶组件
- 组件库设计

---

#### [案例 5：商卡组件（SkuCard）- 组件内聚架构](./05-sku-card-component.md)

**难度**: ⭐⭐⭐ 复杂  
**学习时间**: 40 分钟

展示了一个完整的、生产级别的商卡组件实现，采用**组件内聚架构**：

- 所有相关组件和 Service 在同一目录下
- 通过 PageService 对外暴露统一接口
- 多个 Service 协作处理复杂业务逻辑
- 完整的规格选择、购物车、收藏功能

**适合人群**: 想学习如何构建生产级别的可复用组件，理解模块化架构

**核心概念**:

- 组件内聚架构
- PageService 统一接口
- 多 Service 协作
- 模块化设计
- 性能优化（@Memo 缓存）

---

## 🎯 学习路径

### 路径 1：快速入门（30 分钟）

1. [案例 1：简单计数器](./01-simple-counter.md) - 了解基础概念
2. [案例 2：待办事项列表](./02-todo-list.md) - 学习复杂状态管理

### 路径 2：完整学习（1.5 小时）

1. [案例 1：简单计数器](./01-simple-counter.md)
2. [案例 2：待办事项列表](./02-todo-list.md)
3. [案例 3：用户管理系统](./03-user-management.md)

### 路径 3：深度学习（2 小时）

1. [案例 1：简单计数器](./01-simple-counter.md)
2. [案例 2：待办事项列表](./02-todo-list.md)
3. [案例 3：用户管理系统](./03-user-management.md)
4. [案例 4：组件+Service 新封装模式](./04-component-service-wrapper.md)

### 路径 4：组件库开发（1.5 小时）

1. [案例 4：组件+Service 新封装模式](./04-component-service-wrapper.md) - 学习工厂函数模式
2. [案例 5：商卡组件（SkuCard）](./05-sku-card-component.md) - 学习组件内聚架构

### 路径 5：生产级应用（2.5 小时）

1. [案例 1：简单计数器](./01-simple-counter.md)
2. [案例 2：待办事项列表](./02-todo-list.md)
3. [案例 3：用户管理系统](./03-user-management.md)
4. [案例 5：商卡组件（SkuCard）](./05-sku-card-component.md) - 学习生产级别的组件设计

---

## 📊 案例对比

| 特性         | 案例 1 | 案例 2 | 案例 3 | 案例 4   | 案例 5   |
| ------------ | ------ | ------ | ------ | -------- | -------- |
| 难度         | ⭐     | ⭐⭐   | ⭐⭐⭐ | ⭐⭐⭐   | ⭐⭐⭐   |
| 代码行数     | ~100   | ~400   | ~600   | ~800     | ~1000    |
| Service 数量 | 1      | 1      | 2      | 1 (通用) | 4 (协作) |
| 异步操作     | ❌     | ❌     | ✅     | ✅       | ❌       |
| 依赖注入     | ❌     | ❌     | ✅     | ❌       | ✅       |
| 可复用性     | 低     | 中     | 低     | 高       | 高       |
| 企业级       | ❌     | ❌     | ✅     | ✅       | ✅       |
| 模块化       | ❌     | ❌     | ❌     | 中       | ✅       |
| 内聚架构     | ❌     | ❌     | ❌     | ❌       | ✅       |

---

## 🔑 关键概念速查

### Service 基础

- **定义 Service**: 继承 `Service` 基类，定义状态和方法
- **使用 Service**: 通过 `useService()` 获取实例
- **注册 Service**: 使用 `bindServices()` 注册依赖

### 组件集成

- **observer HOC**: 使组件能够追踪 observable 属性
- **useService Hook**: 从依赖注入容器获取 Service 实例
- **bindServices**: 创建依赖注入容器并通过 Context 提供

### 高级特性

- **计算属性**: 在 Service 中定义 getter，自动计算
- **异步操作**: Service 方法支持 async/await，自动管理 loading/error
- **依赖注入**: 使用 `@Inject()` 装饰器注入其他 Service
- **细粒度更新**: 只追踪实际访问的属性，避免不必要的重新渲染

---

## 💡 最佳实践

### 1. Service 设计

```typescript
// ✅ 好的做法：清晰的职责分离
class UserApiService extends Service {
  // 只负责 API 调用
  async fetchUsers() { ... }
}

class UserService extends Service {
  @Inject() apiService!: UserApiService;
  // 负责业务逻辑和状态管理
  async loadUsers() { ... }
}

// ❌ 避免：混合职责
class UserService extends Service {
  async fetchUsers() { ... }  // API 调用
  async loadUsers() { ... }   // 业务逻辑
}
```

### 2. 组件设计

```typescript
// ✅ 好的做法：使用 observer 包装
const MyComponent = observer(() => {
  const service = useService(MyService);
  return <div>{service.data}</div>;
});

// ❌ 避免：不使用 observer
const MyComponent = () => {
  const service = useService(MyService);
  return <div>{service.data}</div>; // 不会自动更新
};
```

### 3. 状态管理

```typescript
// ✅ 好的做法：在 Service 中定义计算属性
class TodoService extends Service {
  todos: Todo[] = [];

  get completedTodos() {
    return this.todos.filter(t => t.completed);
  }
}

// ❌ 避免：在组件中计算
const TodoList = observer(() => {
  const service = useService(TodoService);
  const completed = service.todos.filter(t => t.completed); // 每次都重新计算
  return <div>{completed.length}</div>;
});
```

---

## 🚀 快速开始

### 1. 安装

```bash
npm install @rabjs/react
```

### 2. 创建 Service

```typescript
import { Service } from '@rabjs/react';

export class CounterService extends Service {
  count = 0;

  increment() {
    this.count++;
  }
}
```

### 3. 创建组件

```typescript
import { observer, useService, bindServices } from '@rabjs/react';

const Counter = observer(() => {
  const service = useService(CounterService);
  return <button onClick={() => service.increment()}>{service.count}</button>;
});

export default bindServices(Counter, [CounterService]);
```

---

## 📖 相关文档

- [快速上手](../react-service/quick-start.md) - 5 分钟快速入门
- [基础用法](../react-service/basic-usage.md) - 学习基本概念
- [深入 Service](../react-service/service-deep-dive.md) - 理解 Service 架构
- [API 文档](../api/react-api.md) - 完整的 API 参考

---

## ❓ 常见问题

### Q: 应该从哪个案例开始？

A: 如果你是初学者，建议从案例 1 开始，然后按顺序学习。如果你有 React 经验，可以直接跳到案例 2 或 3。

### Q: 案例 4 的新模式有什么优势？

A: 新模式通过工厂函数和高阶组件，使得组件+Service 的组合更加可复用和易于维护。特别适合构建组件库。

### Q: 案例 5 的组件内聚架构有什么优势？

A: 组件内聚架构将所有相关的组件和 Service 放在同一个目录下，通过 PageService 对外暴露统一接口。这样做的优势是：

- 模块独立，易于复用和维护
- 职责清晰，多个 Service 协作处理复杂业务
- 内部实现对外透明，只需关心 PageService 接口
- 特别适合构建生产级别的可复用组件

### Q: 如何在实际项目中应用这些案例？

A: 根据你的需求选择合适的模式：

- 简单的状态管理 → 案例 1 的模式
- 复杂的列表操作 → 案例 2 的模式
- 异步操作和多 Service → 案例 3 的模式
- 通用的可复用组件 → 案例 4 的模式
- 生产级别的功能组件 → 案例 5 的模式

### Q: 这些案例可以直接复制使用吗？

A: 可以，但建议先理解每个案例的核心概念，然后根据实际需求进行调整。案例 5 特别适合作为生产级别组件的参考模板。

---

## 🎓 学习建议

1. **理解概念**：先理解每个案例的核心概念，不要只是复制代码
2. **动手实践**：自己动手实现每个案例，遇到问题时查看文档
3. **逐步扩展**：在理解基础案例的基础上，逐步添加新功能
4. **参考最佳实践**：学习每个案例中的最佳实践，应用到自己的项目中
5. **深入研究**：对感兴趣的部分进行深入研究，查看源代码实现

---

## 📝 反馈和建议

如果你有任何问题或建议，欢迎提出 Issue 或 Pull Request！

---

**祝你学习愉快！** 🎉
