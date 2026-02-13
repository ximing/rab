# 严格模式 (Strict Context)

深入了解 RSJS 中的严格模式机制，以及如何通过严格模式来规范 Service 的注册和生命周期管理。

## 什么是严格模式？

严格模式是 RSJS 提供的一种组件树隔离机制，用于**甄别和规范 Service 的注册方式**。通过启用严格模式，你可以强制要求所有 Service 必须显式注册，防止意外的全局单例创建。

默认新项目应该都开启严格模式，只有从低版本 RSJS 升级上来的项目，可以不开启严格模式，方便平滑迁移

## 核心概念

### 1. 严格模式 vs 非严格模式

#### 严格模式（启用 `RSStrict`）

在严格模式下，**所有 Service 必须通过 `register` 或 `bindServices` 显式注册**，否则会抛出异常：

```typescript
import { RSStrict, observer, useService, bindServices } from '@rabjs/react';
import { UserService } from './UserService';

const UserProfile = observer(() => {
  // ✅ 正确：Service 已通过 bindServices 注册
  const service = useService(UserService);
  return <div>{service.name}</div>;
});

// 必须通过 bindServices 注册 Service
export default bindServices(
  () => (
    <RSStrict>
      <UserProfile />
    </RSStrict>
  ),
  [UserService]
);
```

如果在严格模式下使用未注册的 Service，会抛出错误：

```typescript
const UnregisteredComponent = observer(() => {
  // ❌ 错误：Service 未注册，严格模式下会抛出异常
  const service = useService(UnregisteredService);
  return <div>{service.data}</div>;
});

export default bindServices(
  () => (
    <RSStrict>
      <UnregisteredComponent />
    </RSStrict>
  ),
  [UserService] // 缺少 UnregisteredService
);
```

#### 非严格模式（不使用 `RSStrict`）

在非严格模式下，如果 Service 未被注册，系统会**自动将其注册为全局单例**：

```typescript
import { observer, useService } from '@rabjs/react';
import { UserService } from './UserService';

const UserProfile = observer(() => {
  // ✅ 正确：Service 未注册，但会自动注册为全局单例
  const service = useService(UserService);
  return <div>{service.name}</div>;
});

export default UserProfile;
```

## 生命周期管理

### 1. 默认行为：全局单例

在非严格模式下，未注册的 Service 会被自动注册为**全局单例**，这意味着：

- Service 实例在整个应用生命周期内只创建一次
- 所有组件共享同一个 Service 实例
- Service 的状态在组件卸载后仍然保留

```typescript
import { observer, useService } from '@rabjs/react';
import { CounterService } from './CounterService';

const Counter1 = observer(() => {
  const service = useService(CounterService);
  return <div>Counter1: {service.count}</div>;
});

const Counter2 = observer(() => {
  const service = useService(CounterService);
  // 与 Counter1 共享同一个 Service 实例
  return <div>Counter2: {service.count}</div>;
});

export default () => (
  <div>
    <Counter1 />
    <Counter2 />
    {/* 两个计数器显示相同的值，因为它们共享同一个 Service 实例 */}
  </div>
);
```

### 2. Transient 作用域：组件级生命周期

通过声明 Service 的 `scope` 为 `transient`，可以让 Service 的生命周期与当前组件绑定在一起：

```typescript
import { Service } from '@rabjs/react';

export class CounterService extends Service {
  static scope = 'transient'; // 声明为 transient 作用域

  count = 0;

  increment() {
    this.count++;
  }
}
```

在这种情况下：

- 每个使用该 Service 的组件都会获得**独立的 Service 实例**
- Service 实例与组件的生命周期绑定
- 组件卸载时，对应的 Service 实例也会被销毁

```typescript
import { observer, useService } from '@rabjs/react';
import { CounterService } from './CounterService';

const Counter1 = observer(() => {
  const service = useService(CounterService);
  return <div>Counter1: {service.count}</div>;
});

const Counter2 = observer(() => {
  const service = useService(CounterService);
  // 与 Counter1 拥有不同的 Service 实例
  return <div>Counter2: {service.count}</div>;
});

export default () => (
  <div>
    <Counter1 />
    <Counter2 />
    {/* 两个计数器各自独立，显示不同的值 */}
  </div>
);
```

## 使用场景

### 场景 1：企业应用中的严格管理

在大型企业应用中，使用严格模式可以确保所有 Service 都被正确注册和管理：

```typescript
import { RSStrict, bindServices } from '@rabjs/react';
import { UserService } from './services/UserService';
import { ProductService } from './services/ProductService';
import { OrderService } from './services/OrderService';
import App from './App';

// 在应用根部启用严格模式，并注册所有必需的 Service
export default bindServices(
  () => (
    <RSStrict>
      <App />
    </RSStrict>
  ),
  [UserService, ProductService, OrderService]
);
```

### 场景 2：模块级别的隔离

在模块化应用中，可以为不同的模块创建独立的严格模式区域：

```typescript
import { RSStrict, bindServices } from '@rabjs/react';
import { UserModule } from './modules/user';
import { ProductModule } from './modules/product';

const UserModuleWrapper = bindServices(
  () => (
    <RSStrict>
      <UserModule />
    </RSStrict>
  ),
  [UserService, UserProfileService]
);

const ProductModuleWrapper = bindServices(
  () => (
    <RSStrict>
      <ProductModule />
    </RSStrict>
  ),
  [ProductService, ProductDetailService]
);

export default () => (
  <div>
    <UserModuleWrapper />
    <ProductModuleWrapper />
  </div>
);
```

### 场景 3：组件级别的独立状态

使用 `transient` 作用域为每个组件实例提供独立的状态：

```typescript
import { Service } from '@rabjs/react';
import { observer, useService, bindServices } from '@rabjs/react';

// 定义 transient Service
export class FormService extends Service {
  static scope = 'transient';

  formData = {
    name: '',
    email: '',
  };

  updateField(field: string, value: string) {
    this.formData[field] = value;
  }

  reset() {
    this.formData = { name: '', email: '' };
  }
}

const FormComponent = observer(() => {
  const service = useService(FormService);

  return (
    <form>
      <input
        value={service.formData.name}
        onChange={e => service.updateField('name', e.target.value)}
      />
      <input
        value={service.formData.email}
        onChange={e => service.updateField('email', e.target.value)}
      />
      <button onClick={() => service.reset()}>重置</button>
    </form>
  );
});

export default bindServices(FormComponent, [FormService]);
```

## 嵌套 Provider

严格模式支持嵌套 Provider，每个 Provider 都有自己的容器实例。`useService` 会按照 Provider 作用域链向上查找服务：

```typescript
import { RSStrict, bindServices, observer, useService } from '@rabjs/react';
import { UserService } from './UserService';
import { AdminService } from './AdminService';

const UserComponent = observer(() => {
  const userService = useService(UserService);
  return <div>User: {userService.name}</div>;
});

const AdminComponent = observer(() => {
  const adminService = useService(AdminService);
  return <div>Admin: {adminService.role}</div>;
});

const AdminPanel = bindServices(
  () => (
    <RSStrict>
      <AdminComponent />
    </RSStrict>
  ),
  [AdminService]
);

const App = bindServices(
  () => (
    <RSStrict>
      <UserComponent />
      <AdminPanel />
    </RSStrict>
  ),
  [UserService]
);

export default App;
```

在这个例子中：

- `UserComponent` 可以访问外层 Provider 中的 `UserService`
- `AdminComponent` 可以访问内层 Provider 中的 `AdminService`
- 如果内层 Provider 中没有找到 Service，会向上查找外层 Provider

## 最佳实践

### 1. 在应用根部启用严格模式

```typescript
// main.tsx
import { RSStrict, bindServices } from '@rabjs/react';
import App from './App';
import { RootService } from './services/RootService';

const Root = bindServices(
  () => (
    <RSStrict>
      <App />
    </RSStrict>
  ),
  [RootService]
);

ReactDOM.render(<Root />, document.getElementById('root'));
```

### 2. 为不同的作用域选择合适的生命周期

```typescript
// 全局单例 Service（默认）
export class GlobalConfigService extends Service {
  // 不设置 scope，默认为全局单例
  config = { theme: 'light' };
}

// 模块级别 Service
export class ModuleService extends Service {
  // 在 bindServices 中注册，生命周期与模块绑定
  data = [];
}

// 组件级别 Service
export class ComponentService extends Service {
  static scope = 'transient'; // 每个组件实例独立
  state = {};
}
```

### 3. 明确的 Service 注册

```typescript
// ✅ 推荐：在 bindServices 中明确列出所有依赖
export default bindServices(
  () => (
    <RSStrict>
      <App />
    </RSStrict>
  ),
  [
    UserService,
    ProductService,
    OrderService,
    // ... 所有必需的 Service
  ]
);

// ❌ 避免：隐式依赖
export default () => (
  <RSStrict>
    <App />
  </RSStrict>
);
```

## 常见问题

### Q: 什么时候应该使用严格模式？

A: 在以下情况下应该使用严格模式：

- 全新启动的的项目应开尽开

### Q: 严格模式会影响性能吗？

A: 不会。严格模式只是在开发时进行检查，不会对运行时性能产生影响。

### Q: 如何在严格模式下使用第三方 Service？

A: 在 `bindServices` 中注册第三方 Service：

```typescript
import { ThirdPartyService } from 'third-party-lib';

export default bindServices(
  () => (
    <RSStrict>
      <App />
    </RSStrict>
  ),
  [ThirdPartyService]
);
```

### Q: Transient 作用域的 Service 会被垃圾回收吗？

A: 是的。当使用 transient 作用域的组件卸载时，对应的 Service 实例会被自动销毁，允许垃圾回收。

### Q: 可以在严格模式下混合使用不同作用域的 Service 吗？

A: 可以。严格模式只是要求 Service 必须被显式注册，不同作用域的 Service 可以混合使用：

```typescript
export default bindServices(
  () => (
    <RSStrict>
      <App />
    </RSStrict>
  ),
  [
    GlobalService, // 全局单例
    ModuleService, // 模块级别
    TransientService, // transient 作用域
  ]
);
```

## 总结

| 特性             | 严格模式               | 非严格模式         |
| ---------------- | ---------------------- | ------------------ |
| Service 注册     | 必须显式注册           | 自动注册为全局单例 |
| 错误检查         | 严格，未注册会抛出异常 | 宽松，自动处理     |
| 适用场景         | 大型应用、多人协作     | 小型应用、快速原型 |
| 生命周期管理     | 明确、可控             | 隐式、自动         |
| Transient 作用域 | 支持                   | 支持               |

选择合适的模式可以帮助你构建更加健壮和可维护的应用。
