# @rabjs/observer

`@rabjs/observer` 是 rab 的响应式内核：`observable` 把对象/数组/集合包装成细粒度可观察代理，`observe` 把普通函数变成 reaction——执行期间自动记录它读取了哪些属性，之后只有这些属性变化时才重新运行。

```ts
import { observable, observe, unobserve, batch } from '@rabjs/observer';

const state = observable({ count: 0 });

const reaction = observe(() => {
  console.log(state.count); // 立即执行一次: 0
});

state.count = 1; // 重新运行: 1

unobserve(reaction); // 停止追踪, 之后变更不再触发
```

## observe / unobserve

- `observe(fn, options?)`：非 `lazy` 时立即执行一次并收集依赖。`options.scheduler` 可以是函数（自定义调度，如 `setTimeout`、批处理队列）或带 `add` 的对象（如 `Set`，批量收集、稍后统一执行；`delete` 可选——实现了的话 `unobserve` 会调用它移除尚未冲刷的排队条目）；`options.debugger` 会在每次依赖读写时收到 operation 信息。
- `unobserve(reaction)`：把 reaction 标记为 `unobserved`，释放它建立的全部 `(target, key) -> reaction` 连接，并把它从对象型 scheduler（`Set` 等）中移除（仅当 scheduler 实现了 `delete`；只实现 `add` 的调度对象不会因此抛错）。重复调用是安全的。

### unobserve 之后"在途执行"的语义（重要）

`unobserve` 阻止的是**后续排队触发**，但不会（也无法）撤回已经在途的那一次执行：

- **手动调用仍执行**：`unobserve(r)` 之后手动调用 `r()`，函数照常执行一次，只是执行期间不再建立任何新依赖——无论在顶层调用，还是嵌套在另一个正在运行的 reaction 内部调用（其读取不会归属外层 reaction，也不会误触发外层）。之后的数据变更依旧不会触发它。
- **已排期的执行仍落地**：如果 reaction 之前被函数型 scheduler 排期（例如 `scheduler: (r) => setTimeout(r, 30)`），`unobserve` 无法取消闭包里已经持有的引用，定时器到点后 reaction 仍会执行一次（同样不重建依赖）。对象型 scheduler 若实现了 `delete`，`unobserve` 会调用它移除尚未冲刷的排队条目（与上文"add-only 调度对象"契约一致：只实现 `add` 时无条目可移除、也不会抛错）。

也就是说，`unobserve` 的保证是"最后一次在途执行之后不再有新的执行"，而不是"立刻冻结"。如果业务上需要彻底取消（例如组件卸载后不允许再跑一次回调），请在 `unobserve` 的同时自行清理 scheduler 侧的排期（`clearTimeout`、清空队列等）。

该语义由 `src/__tests__/unobserve-post-cancel-semantics.test.ts`、`src/__tests__/unobserve-nested-in-flight.test.ts` 与 `src/__tests__/edge-cases/reactionRunner-coverage.test.ts` 固化。

## batch

`batch(fn)` 把一段同步变更收成一批：同一 reaction 去重，最外层 `batch` 结束时才触发，且读到最终值。嵌套调用安全，返回值原样传出。`batch` 之外的单次赋值仍立即同步执行。

```ts
const state = observable({ a: 1, b: 1 });
observe(() => {
  console.log(state.a + state.b); // 立即执行一次: 2
});

batch(() => {
  state.a = 10;
  state.b = 20;
}); // 只重新运行一次: 30
```

数组变异方法（`push` / `pop` / `shift` / `unshift` / `splice` / `fill` / `sort` / `reverse` / `copyWithin`）从代理上取出时会自动进入 `batch`，一次方法调用只通知每个 reaction 一次。直接 `arr[i] =` / `arr.length =` 仍立即同步通知。

经 `Array.prototype.push.call(arr, ...)` 调用原生方法不会自动 batch（不经过 get trap 取出的包装函数）。

## 已知限制

- **私有字段（`#field`）**：含私有字段的类实例被 `observable()` 包装后，通过代理调用会抛错（`TypeError: Cannot read private member #x from an object whose class did not declare it`）。这是 Proxy 的 brand check 限制——私有字段只认"声明它的类构造出的原始实例"，代理对象通不过检查。绕过方式：
  - 在方法内部用 `raw(this)` 取回原始实例再访问私有字段（`raw` 从 `@rabjs/observer` 导出）；
  - 或者不把这类实例放进 `observable`，改为包装其外层容器，或改用普通闭包/`Symbol` 属性存放"私有"状态。

- **`unobserve` 不取消在途执行**：见上文"unobserve 之后'在途执行'的语义"。需要硬取消语义时由调用方自行清理 scheduler 排期。

- **在途的 unobserved reaction 仍触发 debugger 事件**：`unobserve` 之后在途执行的那一次（手动调用或已排期的 scheduler 回调）执行期间，若它配置了 `debugger`，读写操作仍会收到 debugger 事件——debugger 是观察工具，不因脱管而静默。若不希望看到这些事件，在 debugger 回调里检查 reaction 的 `unobserved` 标记自行过滤。

- **observe 首跑抛错即脱管**：`observe(fn)` 的首次执行（含 `lazy` reaction 的手动首跑）抛错时，异常穿透给调用者，且该 reaction 自动注销——不会留下"半成品"依赖导致后续写入复活它。已成功执行过至少一次的 reaction，后续重跑抛错则**保持存活**（依赖回滚为上次成功运行时的集合，下次变更仍会触发），错误由错误隔离机制上抛，见下条。

- **reaction 执行错误不中断同批**：一次数据变更触发多个 reaction 时，某个 reaction（或其 `debugger`）抛错不会阻止其余 reaction 执行；所有 reaction 跑完后，第一个错误在变更调用点 rethrow。

- **accessor 属性的同值写入会通知**：为避免调用 getter 读旧值（throwing/副作用 getter 会在赋值路径上爆炸），accessor 属性写入时无法安全比较旧值，一律发通知——即对 accessor 属性写入与当前 getter 返回值相同的值，reaction 也会重跑一次。数据属性无此问题（`Object.is` 精确比较）。

- **ES2024 Set 方法（`union`/`intersection`/`difference` 等）返回原始成员**：deep 模式下这些新方法返回的结果集合中元素不经 `observableChild` 包装（与 `values()`/迭代器的深度语义不对称）。旧 React Native JSC 无这些方法，不受影响；需要深度响应式时请用 `values()`/展开等已插桩路径。

- **deep 模式 `Set.keys()`/`entries()` 的键是 proxy**：为保持原生 `keys === values` 身份（#192），deep 模式 Set 的键侧迭代返回与值相同的 observable 包装。因此 proxy 键不能直接与原始集合互操作——`raw(set).has(proxyKey)` 为 `false`。逃生舱：`raw()` 可解包迭代取到的键（`raw([...set.keys()][0]) === 原始成员`），或直接用代理自身的 `has`（入参自动解包）。shadow 模式不包装，keys/entries 的键始终是原始成员。该行为由 `src/__tests__/api/collection.contract.test.ts` 与 `shadow-observable.contract.test.ts` 的契约用例钉住。

- **TypedArray / DataView 不包装**：`Uint8Array`、`Float32Array`、`BigInt64Array`、`Float16Array`、`DataView` 以及其它 `ArrayBuffer.isView` 为真的对象（含跨 realm 与 TypedArray 子类），`observable()` / `shadowObservable()` 原样返回。原因与 Date 相同：`length` / `buffer` / `fill` / 迭代依赖内部槽，Proxy 当 `this` 会抛 `incompatible receiver`。需要响应式请用普通数组，或把 view 放在 observable 容器里、通过替换整段 buffer 通知（`state.bytes = new Uint8Array(...)`）。原地 `state.bytes[0] = 1` 不会触发 reaction。

## 升级与回归

`src/__tests__/api/` 下是 **API 契约测试层**：按公开导出（`observable` / `shadowObservable` / `observe` / `unobserve` / `batch` / 数组 / 集合 / `raw` 等工具与 `configure` / README 示例）组织，每个用例钉住一条"业务可以依赖的行为承诺"，而不是内部实现细节。它是升级时的破坏性变更检测层。

**升级 `@rabjs/observer` 后如何借用**：把本仓库拉下来，在 `packages/observer` 下运行

```bash
npx jest src/__tests__/api
```

- **全绿** = 本次升级对公开 API 无行为变更，可以放心升级。
- **有失败** = 存在行为变更。失败的用例名就是破坏性变更清单——逐条对照业务代码确认是否受影响，再查对应的 changeset 了解变更原因与迁移路径。

**规则承诺**：

- 修改 `src/__tests__/api/` 下任何断言都必须在 changeset 中标注（patch 级别除非显式标注 `breaking`）；破坏性变更需在 PR 里说明迁移路径。
- 引入新行为时，先在契约层补测试、再实现——契约先行，避免"实现定了才发现没钉住"。

**已知限制的钉子**：契约层也钉住了上文"已知限制"中的当前行为（如 accessor 属性同值写入必通知）。如果未来这些行为得到改善，对应契约用例失败是**预期且是好事**——更新断言使其反映新行为，并在 changeset 中注明即可。

## License

MIT
