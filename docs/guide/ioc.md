---
title: IOC容器
order: 2
group:
  title: 进阶指南
  order: 5
---

## 关于 IOC

IOC 容器是基于微软的 [inversify](https://github.com/inversify/InversifyJS) 实现的，所以 inversify 的所有特性均适用于 RabJS 框架

> 注: RabJS 默认使用的 Scope 为单例模式，Inversify 默认为 transient 模式

一般使用的时候可以不考虑 Scope，默认单例模式足够满足大部分场景了。不过在一些高级用法里面通过 Scope 会有不错的表现，比如两个类似的组件公用一个 Service，但是希望是两个实例互相不影响，就可以在注入的时候使用 TransientScope 来分别进行实例化，但是 Service 的实际代码还是一份。

### Scope

官方的 [scope](https://github.com/inversify/InversifyJS/blob/master/wiki/scope.md) wiki 没有太讲清楚， [request_scope.test](https://github.com/inversify/InversifyJS/blob/master/test/features/request_scope.test.ts) 这个单测基本说的就很明白了

[摘抄](https://www.ximing.ren/post/2019/inversifyjs/) 如下

- TransientScope 所有的都是新的，这个很好理解
- SingletonScope 顾名思义单例模式，所有通过容器获取到的实例都是同一个
- RequestScope 同一个对象里面的是同一个实例(除非用 tag 或者 targetName 限制住)

#### RabJS 导出的三种 Scope 变量

```typescript jsx
import { Singleton, Transient, Request } from '@rabjs/core';
```
