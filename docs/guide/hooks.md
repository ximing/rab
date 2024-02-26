---
title: 反应式
order: 3
group:
  title: 进阶指南
  order: 5
---

## 简介

RabJS 使用反应式的思想，当观察的对象有变化的时候自动重新渲染。这种架构模式需要通过收集依赖的方式完成，提供以下两种方法

### 1,view 包裹

所有的组件通过 view 进行包裹,通过 useService 获取对应的 service 实例。这样 view 会自动分析对应的依赖

```typescript
const Demo = view(() => {
  const countService = useService(CountService);
  return <div>number is:{countService.num}</div>;
});
```

### 2,useViewService

可以直接使用 useViewService 获取需要的属性和对应的 service 实例，useViewService 会收集 selector 函数中 使用的 service 变量，从而使组件跟随状态变化重新渲染

> 注：不在 selector 函数中使用的的变量有变化,组件也不会对其进行响应

```typescript
const Demo = () => {
  const [num, countService] = useViewService(CountService, (service) => service.num);
  return <div>number is:{num}</div>;
};
```
