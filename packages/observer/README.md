# @rabjs/observer

`@rabjs/observer` 是 rab 的响应式内核：`observable` 把对象/数组/集合包装成细粒度可观察代理，`observe` 把普通函数变成 reaction——执行期间自动记录它读取了哪些属性，之后只有这些属性变化时才重新运行。

```ts
import { observable, observe, unobserve } from "@rabjs/observer";

const state = observable({ count: 0 });

const reaction = observe(() => {
  console.log(state.count); // 立即执行一次: 0
});

state.count = 1; // 重新运行: 1

unobserve(reaction); // 停止追踪, 之后变更不再触发
```

## observe / unobserve

- `observe(fn, options?)`：非 `lazy` 时立即执行一次并收集依赖。`options.scheduler` 可以是函数（自定义调度，如 `setTimeout`、批处理队列）或带 `add`/`delete` 的对象（如 `Set`，批量收集、稍后统一执行）；`options.debugger` 会在每次依赖读写时收到 operation 信息。
- `unobserve(reaction)`：把 reaction 标记为 `unobserved`，释放它建立的全部 `(target, key) -> reaction` 连接，并把它从对象型 scheduler（`Set` 等）中移除。重复调用是安全的。

### unobserve 之后"在途执行"的语义（重要）

`unobserve` 阻止的是**后续排队触发**，但不会（也无法）撤回已经在途的那一次执行：

- **手动调用仍执行**：`unobserve(r)` 之后手动调用 `r()`，函数照常执行一次，只是执行期间不再建立任何新依赖——之后的数据变更依旧不会触发它。
- **已排期的执行仍落地**：如果 reaction 之前被函数型 scheduler 排期（例如 `scheduler: (r) => setTimeout(r, 30)`），`unobserve` 无法取消闭包里已经持有的引用，定时器到点后 reaction 仍会执行一次（同样不重建依赖）。对象型 scheduler 是例外：`unobserve` 会调用 `scheduler.delete(reaction)`，尚未冲刷的排队条目会被移除。

也就是说，`unobserve` 的保证是"最后一次在途执行之后不再有新的执行"，而不是"立刻冻结"。如果业务上需要彻底取消（例如组件卸载后不允许再跑一次回调），请在 `unobserve` 的同时自行清理 scheduler 侧的排期（`clearTimeout`、清空队列等）。

该语义由 `src/__tests__/unobserve-post-cancel-semantics.test.ts` 与 `src/__tests__/edge-cases/reactionRunner-coverage.test.ts` 固化。

## 已知限制

- **私有字段（`#field`）**：含私有字段的类实例被 `observable()` 包装后，通过代理调用会抛错（`TypeError: Cannot read private member #x from an object whose class did not declare it`）。这是 Proxy 的 brand check 限制——私有字段只认"声明它的类构造出的原始实例"，代理对象通不过检查。绕过方式：
  - 在方法内部用 `raw(this)` 取回原始实例再访问私有字段（`raw` 从 `@rabjs/observer` 导出）；
  - 或者不把这类实例放进 `observable`，改为包装其外层容器，或改用普通闭包/`Symbol` 属性存放"私有"状态。

- **`unobserve` 不取消在途执行**：见上文"unobserve 之后'在途执行'的语义"。需要硬取消语义时由调用方自行清理 scheduler 排期。

## License

MIT
