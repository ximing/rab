# @rabjs/react

## 特性

- 🚀 **响应式组件** - 使用 `observer` / `view` HOC 自动追踪 observable 变化
- 🎣 **Hooks 支持** - `useObserver`、`useLocalObservable`、`useAsObservableSource`
- 💉 **依赖注入** - 内置 IOC 容器，支持 Service 模式和依赖注入
- ⚡️ **并发模式** - 完全支持 React 18+ 的并发特性
- 🛡 **严格模式** - 正确处理 StrictMode 的双重渲染
- 🖥 **SSR 支持** - 通过 `enableStaticRendering` 支持服务端渲染
- 🧹 **内存管理** - 自动清理资源，防止内存泄漏
- 📝 **TypeScript** - 完整的类型支持

## 安装

```bash
npm install @rabjs/react
# 或
pnpm add @rabjs/react
```

> **注意**：`@rabjs/react` 已重新导出了 `@rabjs/observer` 和 `@rabjs/service` 的所有 API，你无需单独安装这两个包。

## 快速开始

### 单页面 Service 模式

适用于复杂业务场景，通过依赖注入管理服务生命周期，支持服务间依赖。

**第一步：定义 Service**

```tsx
import { Service } from '@rabjs/react';

class ProductService extends Service {
  // 所有属性默认是响应式的，无需装饰器
  products = [];
  filterStatus = 'all';

  // 计算属性（getter）
  get filteredProducts() {
    if (this.filterStatus === 'all') return this.products;
    return this.products.filter(p => p.status === this.filterStatus);
  }

  // 所有方法默认是 Action，自动批量更新
  setFilterStatus(status: string) {
    this.filterStatus = status;
  }

  // 异步方法会自动追踪 loading 和 error 状态
  async fetchProducts() {
    const response = await fetch('/api/products');
    this.products = await response.json();
  }
}
```

**第二步：绑定 Service 到组件**

```tsx
import { useService, bindServices } from '@rabjs/react';

// 注意：使用 useService 时组件不需要 observer 包裹
const ProductPage = () => {
  const productService = useService(ProductService);

  return (
    <div>
      <select
        value={productService.filterStatus}
        onChange={e => productService.setFilterStatus(e.target.value)}
      >
        <option value="all">全部</option>
        <option value="active">在售</option>
      </select>
      <div>共 {productService.filteredProducts.length} 个商品</div>

      {/* 访问异步方法的状态 */}
      {productService.$model.fetchProducts.loading && <div>加载中...</div>}
    </div>
  );
};

// bindServices 会自动创建容器并注入 observer
export default bindServices(ProductPage, [ProductService]);
```

### 多级 Domain 嵌套

支持多级领域嵌套，子组件可访问父级 Service，同级 Service 相互隔离。

```tsx
import { Service, bindServices, useService } from '@rabjs/react';

// ========== 应用级 Service ==========
class AppService extends Service {
  appName = 'My App';
  theme = 'light';
}

// ========== 页面级 Service ==========
class PageService extends Service {
  pageTitle = '页面标题';
  data: any[] = [];
}

// ========== 组件级 Service ==========
class ComponentService extends Service {
  componentState = 0;
}

// ========== 应用根（第一级）==========
const AppContent = () => {
  const appService = useService(AppService);
  return (
    <div>
      <h1>{appService.appName}</h1>
      <PageComponent />
    </div>
  );
};

export const App = bindServices(AppContent, [AppService]);

// ========== 页面组件（第二级）==========
const PageContent = () => {
  const appService = useService(AppService); // ✅ 访问父级
  const pageService = useService(PageService); // ✅ 访问当前级

  return (
    <div>
      <h2>{pageService.pageTitle}</h2>
      <ComponentA />
      <ComponentB />
    </div>
  );
};

export const Page = bindServices(PageContent, [PageService]);

// ========== 组件 A（第三级，独立领域）==========
const ComponentAContent = () => {
  const appService = useService(AppService); // ✅ 访问应用级
  const pageService = useService(PageService); // ✅ 访问页面级
  const componentService = useService(ComponentService); // ✅ 访问组件级

  return <div>主题: {appService.theme}</div>;
};

export const ComponentA = bindServices(ComponentAContent, [ComponentService]);

// ========== 组件 B（第三级，独立领域）==========
const ComponentBContent = () => {
  const appService = useService(AppService); // ✅ 访问应用级
  const pageService = useService(PageService); // ✅ 访问页面级
  // ❌ 无法访问 ComponentA 的 ComponentService（同级隔离）

  return <div>页面: {pageService.pageTitle}</div>;
};

export const ComponentB = bindServices(ComponentBContent, [ComponentService]);
```

**特性说明：**

- ✅ 子组件可访问父级容器的 Service
- ✅ 同级容器的 Service 相互隔离
- ✅ 支持任意层级嵌套

## API 文档

### 响应式 API

#### observer(Component)

将函数组件转换为响应式组件，自动追踪 observable 变化并重新渲染。

```tsx
const ProductList = observer(() => {
  return <div>{productService.filteredProducts.length}</div>;
});
```

#### view(Component)

类似 observer，但支持函数组件和类组件。

```tsx
class ClassComponent extends React.Component {
  render() {
    return <div>{store.count}</div>;
  }
}
const ReactiveClass = view(ClassComponent);
```

#### useObserver(selector)

手动追踪 observable 变化，细粒度控制。

```tsx
function MyComponent() {
  const count = useObserver(() => state.count);
  return <div>{count}</div>;
}
```

#### useLocalObservable(initializer)

创建组件内部的 observable 对象。

```tsx
const Counter = observer(() => {
  const state = useLocalObservable(() => ({
    count: 0,
    increment() {
      this.count++;
    },
  }));
  return <button onClick={state.increment}>{state.count}</button>;
});
```

### Service 类

业务服务基类，默认响应式和 Action。

```tsx
class ProductService extends Service {
  products = []; // 响应式属性

  get totalCount() {
    return this.products.length; // 计算属性
  }

  setProducts(products) {
    this.products = products; // 自动 Action
  }

  async fetchProducts() {
    const res = await fetch('/api/products');
    this.products = await res.json();
  }
}

// 异步状态访问
const service = new ProductService();
service.fetchProducts();
console.log(service.$model.fetchProducts.loading); // true
console.log(service.$model.fetchProducts.error); // null | Error
```

**装饰器（可选）：**

- `@Inject(ServiceClass)` - 注入依赖
- `@Debounce(ms)` / `@Throttle(ms)` - 防抖/节流
- `@Memo()` - 缓存计算属性
- `@On(eventName)` / `@Once(eventName)` - 自动监听事件

```tsx
class UserService extends Service {
  @Inject(AuthService) authService!: AuthService;
  @Debounce(300) search(keyword: string) {
    return fetch(`/api/search?q=${keyword}`);
  }
  @Memo() get fullName() {
    return `${this.userInfo?.firstName} ${this.userInfo?.lastName}`;
  }
}
```

### 依赖注入 API

#### bindServices(Component, services)

创建独立容器并注册服务，自动注入 observer。

- **自动注入 observer**：bindServices 会自动将组件包裹为响应式组件
- **服务注册**：在组件挂载时创建容器并注册服务，卸载时销毁
- **子组件可用**：子组件通过 `useService` 访问服务

```tsx
const ProductPage = () => {
  const productService = useService(ProductService);
  return <div>{productService.products.length}</div>;
};

export default bindServices(ProductPage, [ProductService, CategoryService]);
```

#### useService(ServiceClass)

在组件中获取服务实例。会从当前组件向上查找最近的容器。

```tsx
function ProductList() {
  const productService = useService(ProductService);
  return <div>{productService.filteredProducts.length}</div>;
}
```

#### useObserverService(ServiceClass, selector)

获取服务实例并手动追踪特定字段。使用此 Hook 时组件**不需要** `observer` 包裹。

- 返回 `[selectedValue, serviceInstance]`
- 只在 selector 返回值变化时重新渲染

```tsx
function ProductCount() {
  const [count, productService] = useObserverService(ProductService, s => s.products.length);
  return <div>{count}</div>;
}
```

#### useContainer() / useContainerEvents()

获取当前容器或事件发射器。

```tsx
const container = useContainer();
const events = useContainerEvents();
events.on('product:added', handler);
```

### Observable API

#### observable(target) / raw(obj) / isObservable(value)

```tsx
const state = observable({ count: 0 }); // 创建响应式对象
state.count++; // 变化会被追踪

const rawObj = raw(state); // 获取原始对象
isObservable(state); // true
```

#### observe(callback)

创建响应式副作用。

```tsx
const state = observable({ count: 0 });
const dispose = observe(() => console.log(state.count));
state.count++; // 输出: 1
dispose(); // 停止观察
```

### 容器 API

#### Container / register / resolve / has

```tsx
// 手动创建容器
const container = new Container();
container.register(ProductService);
const service = container.resolve(ProductService);

// 全局注册和解析
register(ProductService);
const service2 = resolve(ProductService);
if (has(ProductService)) {
  /* ... */
}
```

### SSR

#### enableStaticRendering(enable)

服务端渲染时禁用响应式追踪。`observer`、`useObserver` 和类组件 `view()` 都不会创建 reaction（`renderToString` 不会 unmount，否则会泄漏订阅）。

```tsx
if (typeof window === 'undefined') {
  enableStaticRendering(true);
}
```

## 最佳实践

### Service 使用

- **逻辑分离**：业务逻辑放 Service，组件负责展示
- **默认特性**：实例默认响应式，方法默认 Action，无需装饰器
- **异步状态**：通过 `service.$model.methodName.loading/error` 访问
- **依赖注入**：用 `@Inject` 注入其他服务

### 响应式

- **自动响应**：`bindServices` 已注入 observer，无需再包裹
- **细粒度**：仅追踪部分状态时用 `useObserverService`
- **避免副作用**：不在 render 中修改状态
- **计算属性**：用 getter 或 `@Memo()` 缓存

### 性能优化

- **批量更新**：Service 方法默认批量更新
- **选择性响应**：用 `useObserverService` 仅在特定字段变化时渲染
- **避免追踪**：用 `raw()` 访问原始对象

### 常见问题

**Q: bindServices 后为何不需要 observer？**  
A: 已自动注入 observer。

**Q: Service 需要装饰器吗？**  
A: 不需要。默认响应式和 Action，装饰器仅用于高级功能。

**Q: observer vs view？**  
A: observer 用于函数组件，view 支持函数和类组件。

**Q: Service 间如何通信？**  
A: 用 `@Inject` 注入或事件系统（`this.emit`/`this.on`）。
