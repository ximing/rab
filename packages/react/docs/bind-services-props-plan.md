# `bindServices` 支持函数化 `servicesList` 的技术方案

## 背景

当前 `@rabjs/react` 的 `bindServices` 只支持静态数组形式的 `servicesList`：

- `bindServices` 在组件首次创建 Domain 时创建子 `Container`
- 遍历 `servicesList`，逐项调用 `container.register(...)`
- 容器实例在当前组件生命周期内保持唯一，卸载时销毁

现有实现已经具备两个关键特征：

1. **容器只初始化一次**：`BindWrapper` 通过 `useRef` 保证同一次挂载周期内只创建一个 `Container`
2. **父子容器关系在初始化时建立**：创建子容器后立即通过 `setParent()` 挂到上层 Domain

在此基础上，希望扩展 `bindServices`，让 `servicesList` 可以是函数，并支持：

- 第一个参数拿到当前 Domain 对应的 `Container`
- 第二个参数拿到组件的 `props`
- 这里的 `props` 仅用于**初始化快照**，后续组件 props 更新时不触发重建，也不回流到 Service 注册逻辑

---

## 现状分析

当前 `bindServices` 的核心行为可以概括为：

```ts
export function bindServices<P extends Record<string, any> = any, TRef = any>(
  Comp: ComponentType<P>,
  servicesList: (
    | [
        ServiceIdentifier | ServiceClass,
        ServiceClass | ServiceFactory | RegisterOptions,
        RegisterOptions,
      ]
    | ServiceClass
  )[],
  options?: { name?: string }
) {
  function createADM(parrent: Container = getGlobalContainer()) {
    const container = new Container({
      name: `${compName}_${++containerId}`,
    });

    container.setParent(parrent);

    for (const params of servicesList) {
      Array.isArray(params)
        ? container.register.apply(container, params)
        : container.register.call(container, params);
    }

    return {
      container,
      timmer: null,
    };
  }
}
```

同时，`@rabjs/service` 底层的 `ServiceFactory` 定义是：

```ts
export type ServiceFactory<T = any> = (container: IContainer) => T;
```

这意味着目前只有两层能力：

- `bindServices` 能创建容器并批量注册
- `Container.register` / `ServiceFactory` 只理解 `container`，不理解 React `props`

因此，如果要让注册逻辑感知组件 props，最合适的切入点是 **`rs-react` 的 `bindServices` 包装层**，而不是下沉到 `rs-service` 的通用 IOC 抽象。

---

## 目标

### 目标

1. `bindServices` 支持静态数组和函数两种 `servicesList` 形态
2. 函数形态拿到当前 Domain 的容器实例和初始化时的 props 快照
3. 保持容器生命周期语义不变：一次挂载只创建一个容器
4. 保持已有数组写法完全兼容
5. 不修改 `@rabjs/service` 的 `ServiceFactory` 通用签名

### 非目标

1. **不支持**在 props 变化后自动重建容器
2. **不支持**在 props 变化后自动重新执行 `servicesList`
3. **不支持**在底层 `Container.register` 中引入 React props 概念
4. **不支持**隐式把最新 props 同步给已创建的 Service

---

## 设计原则

### 1. React 语义留在 `rs-react` 层

`props` 是 React 组件层的概念，不应进入 `@rabjs/service` 的底层容器抽象。否则会带来以下问题：

- `Container.register()` API 被 UI 框架语义污染
- `ServiceFactory` 失去平台无关性
- 未来在非 React 场景（测试、Node、Native、其他 Renderer）复用 IOC 时会出现语义不一致

因此本次设计应只扩展 `bindServices`，不要修改 `ServiceFactory` 定义。

### 2. 初始化参数与运行时同步分离

本次需求本质是“**初始化注册时读取 props**”，而不是“**Service 运行期跟随 props 变化**”。

这两类能力语义不同：

- 初始化参数：用于决定容器启动时注册哪些服务、如何构造服务
- 运行时同步：用于让 Service 对后续 UI 输入变化做出响应

如果把两者混为一体，容易造成：

- props 变化是否要重建服务的不确定性
- Service 生命周期被 React rerender 打断
- 注册逻辑、实例状态、运行期同步逻辑相互耦合

所以本次方案只解决初始化快照问题；运行期同步仍由业务显式实现，例如在组件中通过 `useEffect` 调用 `service.setXXX(props.xxx)`。

### 3. 容器参数应传“当前子容器”而不是“父容器”

函数化 `servicesList` 的第一个参数建议传入 **当前新创建的子容器**，而不是父容器，原因如下：

- 注册动作本身发生在当前子容器上
- 当前子容器已经通过 `setParent()` 挂到父容器，具备完整作用域链能力
- 业务既可以在当前容器上注册，也可以通过当前容器向上 `resolve` 父级服务
- 语义更完整：调用方拿到的就是“当前 Domain 的容器上下文”

---

## API 设计

## 类型定义建议

建议在 `bind.tsx` 内引入更明确的注册类型定义：

```ts
type BindServiceRegistration =
  | ServiceClass
  | [ServiceClass]
  | [ServiceClass, RegisterOptions]
  | [ServiceIdentifier | ServiceClass, ServiceClass | ServiceFactory]
  | [ServiceIdentifier | ServiceClass, ServiceClass | ServiceFactory, RegisterOptions];

type BindServicesFactory<P extends Record<string, any>> = (
  container: Container,
  props: Readonly<P>
) => BindServiceRegistration[];
```

然后将 `bindServices` 签名调整为：

```ts
export function bindServices<P extends Record<string, any> = any, TRef = any>(
  Comp: ComponentType<P>,
  servicesList: BindServiceRegistration[] | BindServicesFactory<P>,
  options?: { name?: string }
);
```

### 兼容性说明

该改动对现有调用方完全兼容：

```ts
// 旧写法：继续有效
bindServices(Page, [ProductService, CategoryService]);

// 新写法：动态工厂
bindServices(Page, (container, props) => [
  [ProductService, () => new ProductService(props.productId)],
]);
```

---

## 运行时语义设计

### 语义定义

当 `servicesList` 为函数时：

- `container`：当前组件对应的 Domain 子容器
- `props`：当前组件在**首次创建 Domain 时**的 props 快照
- 工厂函数仅在当前挂载周期内执行一次
- 后续组件 props 更新时：
  - 不重建容器
  - 不重新执行工厂函数
  - 不自动变更已注册 Service 的初始化参数

### 对“初始化 props”的准确定义

“初始化 props”建议定义为：

> 当前存活这次挂载中，`bindServices` 首次创建容器时读到的 props 值。

这一定义与现有实现的生命周期语义一致，也适用于 React Concurrent / StrictMode 下的行为理解：

- 中途被放弃的 render 不应视为最终生效的初始化
- 最终存活的那次挂载，在首次创建容器时读取到的 props 即为初始化快照

---

## 实现方案

### 1. 为 `servicesList` 增加归一化逻辑

在 `createADM()` 内部增加“数组 / 函数”归一化：

```ts
function normalizeServicesList<P extends Record<string, any>>(
  container: Container,
  props: Readonly<P>,
  servicesList: BindServiceRegistration[] | BindServicesFactory<P>
): BindServiceRegistration[] {
  return typeof servicesList === 'function' ? servicesList(container, props) : servicesList;
}
```

### 2. 在首次挂载时冻结一份 props 快照

在 `BindWrapper` 中增加 `initialPropsRef`：

```ts
const initialPropsRef = useRef<P | null>(null);

if (!admRef.current) {
  initialPropsRef.current = props;
  const adm = createADM(domainContext?.container, initialPropsRef.current);
  admRef.current = adm;
}
```

这里的关键点是：

- 只有在 `admRef.current` 为空时才记录 `initialPropsRef.current`
- 后续 rerender 不覆盖它
- `ViewComp` 仍然收到最新 props，不影响 UI 更新

### 3. 调整 `createADM` 签名

建议将 `createADM` 改为接收初始化 props：

```ts
function createADM(parent: Container = getGlobalContainer(), initialProps: Readonly<P>) {
  const container = new Container({
    name: `${compName}_${++containerId}`,
  });

  container.setParent(parent);

  const registrations =
    typeof servicesList === 'function' ? servicesList(container, initialProps) : servicesList;

  for (const params of registrations) {
    Array.isArray(params)
      ? container.register.apply(container, params as any)
      : container.register.call(container, params);
  }

  return {
    container,
    timmer: null,
  };
}
```

### 4. 透传最新 props 给视图组件

需要强调的是，初始化快照只用于容器和服务注册，**不影响组件本身拿到最新 props**：

```ts
return (
  <DomainContext.Provider value={{ container: admRef.current.container! }}>
    <ViewComp {...props} ref={ref} />
  </DomainContext.Provider>
);
```

这可以保证：

- UI 继续随父组件 props 更新而刷新
- Service 初始化参数保持稳定，不被 rerender 干扰

---

## 使用示例

### 示例一：用 props 初始化 Service

```ts
type ProductPageProps = {
  productId: string;
};

class ProductService extends Service {
  constructor(private options: { productId: string }) {
    super();
  }
}

export const ProductPage = bindServices(Page, (container, props: ProductPageProps) => [
  [ProductService, () => new ProductService({ productId: props.productId })],
]);
```

语义：

- 页面首次创建 Domain 时读取 `props.productId`
- 后续父组件如果传入新的 `productId`，不会自动重建 `ProductService`

### 示例二：基于父级容器中的服务决定注册项

```ts
export const ChildPage = bindServices(Page, (container, props) => {
  const appService = container.resolve(AppService);

  return appService.enableExtra ? [BaseService, ExtraService] : [BaseService];
});
```

语义：

- 当前子容器已经具备向上解析父级依赖的能力
- 动态注册逻辑仍只在初始化阶段执行一次

### 示例三：运行期同步显式处理

如果业务确实希望响应 props 变化，应由业务手动表达：

```ts
function Page(props: { keyword: string }) {
  const service = useService(SearchService);

  useEffect(() => {
    service.setKeyword(props.keyword);
  }, [props.keyword, service]);

  return <div />;
}
```

这与初始化注册职责分离，语义更稳定。

---

## 备选方案与取舍

### 方案 A：修改 `ServiceFactory` 为 `(container, props) => T`

```ts
type ServiceFactory<T = any, P = any> = (container: IContainer, props: P) => T;
```

**不推荐**，原因：

- 将 React props 语义下沉到 IOC 层
- 影响所有 `Container.register()` 的调用模型
- 破坏 `rs-service` 的平台无关性
- 未来会对测试、Node、Native 等非 React 使用场景产生额外负担

### 方案 B：props 变化时自动重跑 `servicesList`

**不推荐**，原因：

- 容器生命周期语义被 props 变化干扰
- 难以定义已创建实例如何处理：复用、销毁还是覆盖
- 会导致重复注册、状态丢失和难以预测的副作用

### 方案 C：props 变化时自动重建整个容器

**不推荐**，原因：

- 破坏当前 `bindServices` “一次挂载一个容器”的稳定语义
- 会导致 Service 实例频繁销毁重建
- 很容易引起请求重发、事件监听丢失、缓存失效等问题

### 最终取舍

采用 **“只扩展 `bindServices`，只支持初始化快照”** 的方案，兼顾：

- 最小改动面
- 与现有生命周期模型一致
- 使用者认知成本低
- 与 `rs-service` 分层职责清晰

---

## 风险与边界

### 1. 业务可能误以为 props 会自动同步

需要在文档中明确说明：

- 工厂函数拿到的是初始化快照
- 后续 props 变化不会重新初始化 Service

### 2. 函数工厂中不应产生额外副作用

`servicesList` 函数应只负责描述注册项，不建议在其中做网络请求、事件订阅等副作用。因为它属于容器初始化路径，职责应保持单一。

### 3. 工厂函数应返回稳定、合法的注册配置

如果工厂函数根据 props 返回非法元组，会直接在 `container.register()` 阶段抛错。因此需要通过类型定义尽量把错误前移到编译阶段。

---

## 测试方案

建议补充以下测试：

### 1. 静态数组写法兼容

- 旧的 `bindServices(Page, [ServiceA, ServiceB])` 行为不变
- 容器正常创建、服务正常解析

### 2. 函数写法可拿到当前容器

- `servicesList(container, props)` 中可直接使用当前容器
- 可以通过当前容器向上 `resolve` 父级服务

### 3. 函数写法可拿到初始化 props

- 首次挂载时读取到正确 props
- 服务实例使用初始化 props 完成构造

### 4. props 更新不触发重建

- 父组件修改 props 后，`servicesList` 不会再次执行
- 容器实例保持同一个
- Service 实例保持同一个

### 5. UI 仍收到最新 props

- 包装后的 `ViewComp` 仍使用最新 props 渲染
- 证明“UI props 更新”和“Service 初始化快照”已解耦

### 6. 卸载后正常销毁

- 容器在卸载时正常 `destroy`
- 并发模式相关的兜底回收逻辑不受影响

---

## 实施步骤

1. 在 `bind.tsx` 中引入新的 `BindServiceRegistration` / `BindServicesFactory` 类型
2. 扩展 `bindServices` 参数签名，支持数组或函数
3. 在 `BindWrapper` 中引入 `initialPropsRef`，只在首次创建容器时记录 props
4. 调整 `createADM` 接口，使其基于 `initialProps` 计算注册项
5. 增加测试，覆盖静态写法兼容与动态工厂行为
6. 在 `README` 或相关文档中补充“初始化 props 快照”的语义说明

---

## 结论

本方案建议：

- **只在 `@rabjs/react` 的 `bindServices` 层支持函数化 `servicesList`**
- **函数签名为 `(container, initialProps) => registrations`**
- **其中 `initialProps` 明确为首次创建 Domain 时的 props 快照，不跟随后续 props 更新变化**
- **不修改 `@rabjs/service` 的 `ServiceFactory` 签名，不把 React props 语义下沉到 IOC 层**

这样既能满足“基于容器和初始化 props 决定服务注册”的需求，又能保持现有容器生命周期、职责分层和向后兼容性。
