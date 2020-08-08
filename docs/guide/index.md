---
title: 介绍
order: 0
nav:
  title: 介绍
  order: 0
---

# 介绍

RabJS 是一个基于依赖注入理念实现的状态管理框架，使用 Proxy 进行做数据的代理劫持，具有完备的 TypeScript 支持。

> 注意：本框架是基于 React 16.8 提出的新特性 [Hooks](https://zh-hans.reactjs.org/docs/hooks-intro.html) 研发，请确保已经阅读过相关文档
>
> 推荐阅读 [React Hooks 详解 ](https://juejin.im/post/5dbbdbd5f265da4d4b5fe57d) [官方文档](https://zh-hans.reactjs.org/docs/hooks-intro.html)

## 理念

#### 1.简单易用

API 尽可能简单，少写代码，摒弃类似 redux 中所有冗余的重复样板代码

#### 2.完美地支持 Typescript

在聊 RXJS 之前，先了解一下原生 Redux 和 Typescript 怎么一起使用， 用使用频率最高的 connect 举个例子：

```typescript jsx
interface StateProps {
  count: number;
}

interface DispatchProps {
  increment: () => void;
}

interface OwnProps {
  name: string;
}

export default connect<StateProps, DispatchProps, OwnProps>(
  mapStateToProps,
  mapDispatchToProps
)(MyComponent);
```

为了 让 MyComponent 的 props 有正确的类型断言，必须手写 StateProps 和 DispatchProps，这是一件很麻烦的事情，同时没有体现出使用 Typescript 的优势所在。反而是一种负的开发体验。

理想的情况应该是 connect 之后 MyComponent 的 props 能被自动推倒出来。但是基于 HOC 的使用方式，这方面暂时无解，除非使用 render props，但是 render props 会导致很深的回调金字塔问题。

所以 RXJS 做了进一步的优化

- 放弃 connect、Provider
- 使用 React Hooks，放弃 HOC 和 render props
- 使用多 store，保证项目可以是分形的

使用 RXJS 之后如下

```typescript jsx
export const MyComponent = view(() => {
  const countService = useService(CountService);
  return (
    <div>
      <p>demoFC:</p>
      <button
        onClick={() => {
          countService.increment();
        }}
      >
        click
      </button>
      demo count{countService.count}
    </div>
  );
});
```

countService 可以直接推到出 action increment 和 state count，不需要业务开发人员再重新定义一遍对应的类型

#### 3.让业务代码有良好地组织方式

这里我们推荐使用分形架构

> 如果子组件能够以同样的结构，作为一个应用使用，这样的结构就是分形架构。

在分形架构的要求下，状态管理一定不是一个集中式的 store，传统的 Redux 的开发要求导致我们会尽可能的将状态放到全局的状态中，但是通常很多状态是局部的 UI 状态，没有必要放到全局中。这样做一是写起来很繁琐，我们通常需要在几个分属于不同功能的文件夹中的文件来回跳转才能搞清楚一个业务流程的全过程，二是整个项目耦合很严重，通常 actions 或者 reduce 文件中会包含很多其他业务的代码，大家互相耦合在一起

在大的项目中我们更倾向于具有相同业务属性的功能高内聚在一起形成一个模块，所有的模块组成一个可插拔的插件式的架构。一些必要的耦合是通过项目基架来提供的，每个模块只需要勾住对应的钩子即可完成相应的开发工作。

基于以上的介绍，业务代码应该尽量保持以下特征：

- 代码风格是与团队代码风格一致的，这个可以通过 eslint 做约束
- 代码是模块化的，不应该一个文件包含所有业务逻辑，必须做物理拆分
- 逻辑是分层的，Service 是一层，View 是一层，核心业务逻辑是一层，可以参考 MV\*，每一层不应该掺杂其他层的职能
- 视图是组件化的，将通用视图交互逻辑层层抽象封装，进一步简化核心视图复杂度

## 目录规范

每个模块具有两个必要的文件，一个是入口视图文件，一个是服务层文件

```
- modules
-- aModule
--- ComponentsDir
--- index.tsx
--- index.service.ts
```

## 特性

- [x] 分形架构
- [x] reactivity
- [x] 依赖注入
- [x] 完整的 typescript 支持
- [ ] DevTools 集成
