---
title: core
order: 0
nav:
  title: API
  order: 2
---

## useService

获取 Service 实例

```typescript jsx
import { view, useService } from '@rabjs/core';
export default view(() => {
  const demoService = useService(DemoService);
  //...
});
```

#### ts 定义

```typescript jsx
export declare function useService<M extends Service>(
  serviceIdentifier: ConstructorOf<M>,
  options?: UseServiceOptions
): ServiceResult<M>;
export interface UseServiceOptions {
  scope?: ScopeType;
  resetOnUnmount?: boolean;
}
```

#### 参数

1.  Service 类
2.  options
    - 2.1 scope 见 [框架导出的三种 scope](../guide/ioc.md#框架导出的三种-scope-变量)
    - 2.2 组件卸载时重置 Service 的 state （暂时不推荐使用）

#### 返回值

返回 service 实例

## useViewService

获取 Service 实例

> 注：此时不需要使用 view 对组件进行包裹，详情见 [反应式](../guide/hooks.md)

```typescript jsx
import { useService } from '@rabjs/core';
export default () => {
  const [state, demoService] = useViewService(DemoService, (demo) => demo.state);
  //...
};
```

#### ts 定义

```typescript jsx
export declare function useViewService<M extends Service, S>(
  serviceIdentifier: ConstructorOf<M>,
  selector: (service: ServiceResult<M>) => S,
  options?: UseServiceOptions
): [S, M];

export interface UseServiceOptions {
  scope?: ScopeType;
  resetOnUnmount?: boolean;
}
```

#### 参数

1.  Service 类
2.  selector 函数，入参是 service 实例，返回所需要的 state
3.  options
    - 3.1 scope 见 [框架导出的三种 scope](../guide/ioc.md#框架导出的三种-scope-变量)
    - 3.2 组件卸载时重置 Service 的 state （暂时不推荐使用）

#### 返回值

数组 [selector 返回值,service 实例]

## view

包裹组件，用来收集依赖

#### ts 定义

```typescript jsx
export declare function view<P = any, S = any>(Comp: ComponentType<P>): ComponentType<P>;
```

#### 参数

传入待观察的 react 组件，支持函数式组件和 class 组件

#### 返回值

高阶组件

## getService

获取 service 实例

> 不推荐业务同学直接使用此函数，react 组件中可以直接使用 useService，service 中可以通过 [注入其他 service](../guide/service.md) 获取 Service 实例

#### ts 定义

```typescript
export interface GetServiceOptions {
  scope?: ScopeType;
}
export declare const getService: <M extends Service>(
  serviceIdentifier: ConstructorOf<M>,
  options?: GetServiceOptions | undefined
) => M;
```

#### 参数

1.  Service 类
2.  options
    - 2.1 scope 见 [框架导出的三种 scope](../guide/ioc.md#框架导出的三种-scope-变量)

#### 返回值

service 实例
