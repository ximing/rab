---
title: 注入其他service
order: 1
group:
  title: 进阶指南
  order: 5
---

## 注入其他 service

实际项目中可能存在 AService 依赖 BService 的情况，这时候我们可以使用依赖注入的方式，直接声明所需 Service 即可，框架会自动将其实例化并注入进去

### 属性注入

以上的注入均可以通过属性注入的方式来完成

```typescript
@Injectable()
class CountService extends Service {
  count = 0;

  // type 1
  @Inject(OtherService) other!: OtherService;

  setCount(count: number) {
    this.count = count;
  }

  syncCount() {
    this.count = this.other.count;
  }
  proxySubtract(n: number) {
    return this.other.subtract(n);
  }
}
```

#### 声明 Scope

我们可以通过声明 Scope 来决定注入的服务生命周期范围，如下

```typescript
@Injectable()
class CountService extends Service {
  count = 0;
  // type 2
  @Scope(Transient)
  @Inject(OtherService)
  other2!: OtherService;
}
```

### 构造函数注入

> 注意：经过 Babel 构建之后会丢失一些 meta 信息，所以构造函数注入是没办法用到 MRN/R2M 等使用 babel 的项目中的

#### 常规的注入方式

全局使用同一个单例

```typescript
@Injectable()
class CountService extends Service {
  count = 0;
  // type 2
  constructor(public other1: OtherService) {
    super();
  }

  setCount(count: number) {
    this.count = count;
  }

  syncCount() {
    this.count = this.other.count;
  }
  proxySubtract(n: number) {
    return this.other1.subtract(n);
  }
}
```

#### 声明 Scope

我们可以通过声明 Scope 来决定注入的服务生命周期范围，如下

```typescript
@Injectable()
class CountService extends Service {
  count = 0;
  // type 2
  constructor(
    @Scope(Transient)
    public other2: OtherService
  ) {
    super();
  }
}
```

#### 循环引用

出现循环引用的时候，可以使用 LazyServiceIdentifer 的方式将初始化注入对象的过程延后到使用的时候

```typescript
@Injectable()
class CountService extends Service {
  count = 0;
  // type 2
  constructor(
    @Inject(new LazyServiceIdentifer(() => OtherService))
    public other2: OtherService
  ) {
    super();
  }
}
```
