# 手动事件监听清理方案

## 背景

当前 `Service.destroy()` 会清理以下资源：

- `@On` / `@Once` 装饰器注册的事件监听
- `@Debounce` 定时器
- `@Throttle` 定时器
- `@Memo` 的 reaction 与缓存

但手动调用 `this.on()` / `this.once()` 注册的监听并没有进入统一的清理账本，只是直接挂到了 `EventEmitter` 上。

这会带来两个问题：

1. `scope: "global"` 时，全局 emitter 会持续持有 handler，间接持有 service 实例。
2. `scope: "container"` 时，如果先调用 `service.destroy()`，但容器未销毁，监听仍然存在。

## Root Cause

问题的根因不是 `destroy()` 没有调用，而是**手动监听注册时没有留下可回收的记录**。

当前实现中：

- `@On` / `@Once` 通过 `setupEventListeners()` 绑定后，会把 `{ eventName, handler, scope, emitter }` 记录到 `__boundEventHandlers`
- `cleanupEventListeners()` 会遍历 `__boundEventHandlers` 执行 `emitter.off(...)`
- `Service.on()` / `Service.once()` 直接调用 `emitter.on()` / `emitter.once()`，没有写入 `__boundEventHandlers`

因此，`destroy()` 虽然执行了 `cleanupEventListeners(this)`，但它只能清理装饰器路径注册的监听，无法触达手动注册的监听。

## 目标

本次方案的目标是：

- 让 `this.on()` / `this.once()` 注册的监听进入统一生命周期管理
- 保持现有公开 API 不变
- 保持装饰器路径与手动路径的行为一致
- 让 `Service.destroy()` 成为事件监听的唯一兜底回收入口
- 避免 `off()` 误删其他 service 的监听

## 非目标

本方案暂不处理以下事项：

- 业务方直接拿到 `EventSystem.getEmitter(...).on(...)` 后绕过 `Service` API 绑定的监听
- `Container` 级别的 transient 实例销毁问题
- `unregister()` 未触发实例销毁的问题

## 设计原则

### 1. 注册时记账，销毁时回收

不要在 `destroy()` 阶段尝试从 emitter 反向扫描监听器来源，而应该在注册监听器时就记录所有必要信息。

### 2. 手动路径与装饰器路径统一

`this.on()` / `this.once()` 与 `@On` / `@Once` 最终应落到同一套底层注册与清理逻辑上，避免两套生命周期管理继续分叉。

### 3. 清理粒度以当前 service 为边界

`service.off("event")` 不应该调用 `emitter.removeAllListeners("event")`，否则会误删同一容器或全局 emitter 上其他 service 的监听。

### 4. once 监听要能自清理

`once` 监听触发后，除了从 emitter 中移除，还要从内部登记表中移除，避免留下无效记录。

## 方案概览

建议新增一层内部的“事件监听登记表”，由它统一承接：

- 手动 `this.on()`
- 手动 `this.once()`
- `@On`
- `@Once`

整体思路如下：

1. 抽离一个内部模块，专门负责监听注册、登记、解绑和批量清理。
2. 所有事件监听注册统一写入 service 实例上的内部 registry。
3. `Service.on()` / `Service.once()` 改为走 registry 注册，而不是直接操作 emitter。
4. `setupEventListeners()` 也改为走同一 registry。
5. `cleanupEventListeners()` 只依赖 registry 做统一解绑。
6. `Service.off()` 改为只移除“当前 service 自己登记过”的监听，不再调用 `removeAllListeners()`。

## 详细设计

## 一、抽离统一的内部 registry 模块

建议新增内部模块，例如：

- `reactive-state/service/src/event-listener-registry.ts`

职责：

- 为 service 实例创建监听登记表
- 注册监听并写入登记表
- 按条件解绑监听
- 批量清理当前 service 的全部监听
- 处理 once 的自动摘除

### 建议的数据结构

```typescript
interface EventListenerRecord {
  eventName: string;
  scope: EventScope;
  emitter: EventEmitter;
  originalHandler: (...args: any[]) => void;
  subscribedHandler: (...args: any[]) => void;
  once: boolean;
  source: 'manual' | 'decorator';
  active: boolean;
}
```

### 建议的存储方式

建议使用 `Symbol` 挂在 service 实例上，避免与业务字段冲突：

```typescript
const EVENT_LISTENER_REGISTRY = Symbol('rs-service:event-listener-registry');
```

这样可以避免继续使用字符串字段名（例如 `__boundEventHandlers`）暴露实现细节，也能降低业务代码误覆盖的风险。

## 二、统一注册入口

建议在 registry 模块里提供统一入口，例如：

```typescript
bindTrackedEventListener(service, {
  eventName,
  handler,
  scope,
  once,
  container,
  source,
});
```

该方法负责：

1. 根据 `scope` 和 `container` 取到 emitter
2. 为 handler 构造真正订阅到 emitter 的 `subscribedHandler`
3. 把 record 写入 registry
4. 调用 `emitter.on(eventName, subscribedHandler)` 完成注册

### 为什么建议统一用 `emitter.on()`，而不是手动路径继续用 `emitter.once()`

为了让 `once` 的生命周期完全可控，建议对 `once` 使用包装函数：

```typescript
const subscribedHandler = (...args: any[]) => {
  try {
    originalHandler(...args);
  } finally {
    unbindTrackedEventListener(service, record);
  }
};
```

这样有几个好处：

- 触发一次后，能同时从 emitter 和 registry 中移除
- 即使 handler 抛错，也能在 `finally` 里完成清理
- 不需要依赖第三方库对 `once/off` 匹配细节的内部实现

## 三、手动 API 改造方案

### `Service.on()`

当前：

- 直接 `emitter.on(eventName, handler)`

改造后：

- 调用统一的 `bindTrackedEventListener(..., once: false, source: "manual")`

### `Service.once()`

当前：

- 直接 `emitter.once(eventName, handler)`

改造后：

- 调用统一的 `bindTrackedEventListener(..., once: true, source: "manual")`

### `Service.off()`

当前实现存在两个问题：

1. 只能处理调用方显式传入的 handler
2. `handler` 缺省时会 `removeAllListeners(eventName)`，会误删其他 service 的监听

改造后建议：

- 如果传入 `handler`，则仅移除当前 service 下匹配 `eventName + handler + scope` 的记录
- 如果不传 `handler`，则仅移除当前 service 下匹配 `eventName + scope` 的记录
- 不再直接调用 `emitter.removeAllListeners(eventName)`

这样 `off()` 的语义会从“清空整个 emitter 上该事件的监听”收敛为“清理当前 service 自己注册的监听”，更符合 Service 生命周期边界。

## 四、装饰器路径改造方案

`setupEventListeners()` 当前会自行：

- 绑定 handler
- 注册到 emitter
- 写入 `__boundEventHandlers`

建议改造为复用统一 registry：

```typescript
bindTrackedEventListener(service, {
  eventName,
  handler: prototype[propertyKey].bind(service),
  scope,
  once: isOnce,
  container,
  source: 'decorator',
});
```

这样装饰器路径和手动路径最终只有一套：

- 注册逻辑
- once 自清理逻辑
- 批量 cleanup 逻辑
- off 匹配逻辑

## 五、销毁流程调整

`Service.destroy()` 现有结构可以保留，但 `cleanupEventListeners(this)` 的语义需要升级为：

- 清理当前 service registry 中所有仍处于 active 状态的监听
- 对每条记录执行 `emitter.off(eventName, subscribedHandler)`
- 清空 registry

理想情况下，`destroy()` 不需要知道监听来自手动还是装饰器路径。

## 六、行为约定

### 1. 重复注册

如果同一个 service 使用同一个 handler 多次调用 `on()`，应视为多条独立订阅记录，行为与 `EventEmitter` 一致。

### 2. `off(handler)` 的匹配策略

建议匹配 `originalHandler`，而不是 `subscribedHandler`。

这样对业务方来说更自然：

```typescript
const handler = () => {};
service.on('x', handler);
service.off('x', handler);
```

### 3. `once` 已触发后的记录

一旦 `once` 触发完成，就应该立即把对应 record 从 registry 中移除，避免：

- `destroy()` 二次清理无效记录
- registry 长期积累历史垃圾数据

### 4. `destroy()` 幂等

`Service.destroy()` 本身已经是幂等友好的，新的 registry 清理也应保持幂等：

- 已移除的 record 不再重复解绑
- 已清空 registry 再次 cleanup 时直接返回

## 模块边界建议

为了避免 `service.ts` 与 `decorators/on.ts` 继续互相承载生命周期细节，建议把公共逻辑下沉到独立模块：

- `event-listener-registry.ts`：统一注册、查询、解绑、清理
- `service.ts`：只负责对外暴露 `on/once/off/destroy`
- `decorators/on.ts`：只负责读取元数据，并调用 registry 完成绑定

这样职责会更清晰：

- `Service` 负责生命周期入口
- decorator 负责声明式元数据
- registry 负责实际监听资源管理

## 兼容性分析

### 对外 API

本方案不改变以下公开 API：

- `service.on(eventName, handler, scope?)`
- `service.once(eventName, handler, scope?)`
- `service.off(eventName, handler?, scope?)`
- `service.destroy()`

业务代码无需修改调用方式。

### 行为变化

唯一需要明确说明的行为变化是：

- `service.off("event")` 未来只会移除当前 service 自己注册的该事件监听
- 不再清空整个 emitter 上该事件的所有监听器

这是一个向正确生命周期边界收敛的修正，虽然与当前实现不同，但属于修 bug，不属于破坏性 API 升级。

## 测试方案

建议补充以下测试：

### 1. 手动 `on()` + global + destroy

验证：

- `service.on("x", handler, "global")`
- `service.destroy()` 后
- 再次触发全局事件，不会执行 handler

### 2. 手动 `on()` + container + destroy

验证：

- 容器不销毁
- 仅调用 `service.destroy()`
- 再次触发容器事件，不会执行 handler

### 3. 手动 `once()` 未触发前 destroy

验证：

- `service.once("x", handler)`
- 在事件触发前执行 `destroy()`
- 后续 emit 不再触发 handler

### 4. 手动 `once()` 触发后自清理

验证：

- 触发一次后 handler 只执行一次
- registry 中对应记录已被清除
- `destroy()` 不会重复处理无效记录

### 5. `off(eventName, handler)` 仅移除当前 service 的匹配监听

验证：

- 两个 service 在同一 emitter 上监听同一事件
- 一个 service 调用 `off(eventName, handler)`
- 另一个 service 的监听仍然存在

### 6. `off(eventName)` 不误删其他 service 的监听

验证：

- 两个 service 均监听同一事件
- 一个 service 调用 `off(eventName)`
- 只移除自身记录，不影响另一个 service

### 7. 装饰器路径回归

验证：

- `@On` / `@Once` 仍然自动绑定
- `destroy()` 后仍能正常清理
- 与手动路径共享同一套 cleanup 逻辑

## 实施步骤

建议按以下顺序落地：

1. 新增内部 registry 模块与类型定义
2. 改造 `cleanupEventListeners()`，让它基于 registry 工作
3. 改造 `setupEventListeners()`，接入统一注册入口
4. 改造 `Service.on()` / `Service.once()` / `Service.off()`
5. 补充手动路径的生命周期测试
6. 补充 `off()` 不误删其他 service 的回归测试

## 推荐结论

推荐采用“统一事件监听登记表”的方案，而不是在 `destroy()` 阶段做补救式扫描。

原因是：

- 注册时记账最可靠
- 可以同时覆盖手动路径和装饰器路径
- 能彻底消除 `global` emitter 长持有 service 的泄露风险
- 顺带修复 `off()` 的误删问题
- 后续若增加新的事件注册语法，也可以继续复用同一套资源管理机制

该方案改动范围可控，边界清晰，适合作为 `reactive-state/service` 事件生命周期的标准实现。
