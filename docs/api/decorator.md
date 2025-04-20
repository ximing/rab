---
title: 装饰器
order: 1
---

## Injectable

包裹组件，用来收集依赖

#### ts 定义

```typescript
export declare const Injectable: <T extends ConstructorOf<Service>>() => (target: T) => any;
```

#### 参数

无

#### 返回值

无

## Scope

包裹组件，用来收集依赖

#### ts 定义

```typescript
export declare const Scope: (
  scope: ScopeType
) => (target: any, key: string, index?: number | undefined) => void;
```

#### 参数

scope 见 [框架导出的三种 scope](../guide/ioc.md#框架导出的三种-scope-变量)

#### 返回值

无

## Inject

注入 Service 时可以指定被注入的是哪个 Service

#### ts 定义

```typescript
export declare const Inject: <
  T extends
    | string
    | symbol
    | interfaces.Newable<any>
    | interfaces.Abstract<any>
    | LazyServiceIdentifer<any>,
>(
  serviceIdentifier: T
) => (target: any, key: string, index?: number | undefined) => void;
```

#### 参数

希望被注入的 Service 类构造函数，或者 LazyServiceIdentifer，详情见 [注入其他 service
](../guide/service.md)

#### 返回值

无
