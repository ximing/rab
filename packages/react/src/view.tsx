/**
 * view HOC - 支持函数组件和类组件的响应式包装器
 *
 * 函数组件：使用 observer 实现（基于 Hooks + useSyncExternalStore）
 * 类组件：使用 observe + forceUpdate 实现
 */
import {
  observe,
  unobserve,
  isRewritableMap,
  isRewritableSet,
  isWeakMapTarget,
  isWeakSetTarget,
  type Reaction,
} from '@rabjs/observer';
import { ComponentType, ComponentClass } from 'react';

import { observer } from './observer';
import { isUsingStaticRendering } from './static-rendering';
import { notifyReactStore } from './utils/notify-react-store';
import { IS_REACTIVE_COMPONENT, isClassComponent } from './utils/react-helper';

/**
 * 组合生命周期函数的品牌标记：构造期/render 期重绑过的字段带此标记，
 * 避免重复包装；子类 extends view(Base) 时其字段初始化在 super() 之后
 * 执行，会覆盖掉包装器构造期组合好的函数字段（无品牌）——render 阶段
 * 据此识别并重新组合。
 */
const COMPOSED_BY_VIEW = Symbol('__rabjs_view_composed_lifecycle__');

/**
 * 挂载快照的一条记录：首渲染（commit 前，不做依赖追踪）读到的一个
 * observable 位置及当时读到的值。
 */
interface MountSnapshotEntry {
  target: object;
  key: PropertyKey;
  type: string;
  /** 读取当时的快照值；UNREADABLE 表示无法安全重读（按已变化处理） */
  value: unknown;
}

/** 快照值无法安全捕获/重读时的哨兵 —— 对比时按「已变化」处理（宁可多更一次） */
const UNREADABLE = Symbol('__rabjs_view_snapshot_unreadable__');

/**
 * 沿原型链查找数据属性的值。accessor（getter）不执行 —— Reflect.get 会
 * 真实调用用户 getter（@Memo 等），且 this 是 raw 实例：@Memo 会以 raw
 * 身份另建一份注册不到任何依赖的 CacheState（raw 读取不过 proxy trap），
 * 既让 getter 在挂载期多执行一次，又留下永不失效的陈旧缓存。accessor
 * 一律返回 UNREADABLE（按「已变化」处理，宁可多更一次）。
 */
function readDataPropertyValue(target: object, key: PropertyKey): unknown {
  let obj: object | null = target;
  while (obj) {
    const desc = Object.getOwnPropertyDescriptor(obj, key);
    if (desc) {
      return 'value' in desc ? desc.value : UNREADABLE;
    }
    obj = Object.getPrototypeOf(obj);
  }
  // 属性不存在：Reflect.get 也会安全地得到 undefined
  return undefined;
}

/**
 * 读取一个被追踪位置的当前值（快照捕获与挂载时对比共用）。
 * 只读 raw target，不经过 proxy trap，不产生依赖注册；
 * 集合类型用原生方法读取，不触发任何用户代码。
 */
function readSnapshotValue(target: object, key: PropertyKey, type: string): unknown {
  // 集合判定必须用 observer 的跨 realm 判定（tag + duck-check，issue #92
  // 场景）而非裸 instanceof —— 裸 instanceof 对 vm/iframe 里的 Map/Set
  // 为 false，而 collection-handler 的 G7 路由会把它们送进 instrumented
  // trap，两边判定不一致会让快照对比对跨 realm 集合静默失效。
  try {
    if (type === 'iterate') {
      // Map/Set 迭代依赖关心内容本身（值覆盖也算变化），做全量快照；
      // 普通对象/数组的迭代依赖只关心键集合（元素值由各自的 get 记录覆盖）
      if (isRewritableMap(target)) {
        return [...target.entries()];
      }
      if (isRewritableSet(target)) {
        return [...target.values()];
      }
      return Reflect.ownKeys(target);
    }
    if (type === 'key-iterate') {
      // Map.keys() 的 key 侧迭代依赖（#211 与值侧 iterate 分桶）：
      // 关心 key 集合本身，快照 key 列表 —— 落入下方 get 分支会对
      // key='' 读出 undefined≡undefined，key 增删永远判不出差异
      if (isRewritableMap(target)) {
        return [...target.keys()];
      }
      // key-iterate 只会注册在 Map 上（Set 的 key 迭代走 iterate 桶）
      return UNREADABLE;
    }
    if (type === 'has') {
      // Weak 集合同样走原生方法：collection-handler 对 WeakMap.has /
      // WeakSet.has 也注册 'has' 依赖，用 Reflect.has 读 WeakSet 恒得
      // false，捕获与对比两端恒等会让窗口内 add 静默丢失
      if (
        isRewritableMap(target) ||
        isRewritableSet(target) ||
        isWeakMapTarget(target) ||
        isWeakSetTarget(target)
      ) {
        return target.has(key as never);
      }
      return Reflect.has(target, key);
    }
    // get（WeakMap.get 同理注册 'get' 依赖，不能落入 readDataPropertyValue
    // 恒读 undefined）
    if (isRewritableMap(target) || isWeakMapTarget(target)) {
      return target.get(key as never);
    }
    return readDataPropertyValue(target, key);
  } catch {
    return UNREADABLE;
  }
}

/** 对比快照值与当前值；iterate 快照是数组（Map 为 [k,v] 对），逐元素比较 */
function snapshotValueEquals(entry: MountSnapshotEntry, current: unknown): boolean {
  if (entry.value === UNREADABLE || current === UNREADABLE) {
    return false;
  }
  if (entry.type === 'iterate' || entry.type === 'key-iterate') {
    const prev = entry.value as unknown[];
    const next = current as unknown[];
    if (prev.length !== next.length) {
      return false;
    }
    // 逐对比较仅适用于 Map 的值侧 iterate（[k,v] 元组）；
    // key-iterate 快照是纯 key 列表，与 Set/对象一样逐元素比较
    const isPairwise = entry.type === 'iterate' && isRewritableMap(entry.target);
    for (let i = 0; i < prev.length; i++) {
      if (isPairwise) {
        const [pk, pv] = prev[i] as [unknown, unknown];
        const [nk, nv] = next[i] as [unknown, unknown];
        if (!Object.is(pk, nk) || !Object.is(pv, nv)) {
          return false;
        }
      } else if (!Object.is(prev[i], next[i])) {
        return false;
      }
    }
    return true;
  }
  return Object.is(entry.value, current);
}

/** 挂载快照是否在「首渲染 → _onDidMount」的 commit 窗口内失效 */
function isMountSnapshotStale(snapshot: MountSnapshotEntry[]): boolean {
  for (const entry of snapshot) {
    if (!snapshotValueEquals(entry, readSnapshotValue(entry.target, entry.key, entry.type))) {
      return true;
    }
  }
  return false;
}

/**
 * view HOC - 将组件转换为响应式组件
 *
 * @example
 * // 函数组件
 * const FuncComp = view((props) => {
 *   return <div>{store.count}</div>;
 * });
 *
 * // 类组件
 * class ClassComp extends React.Component {
 *   render() {
 *     return <div>{store.count}</div>;
 *   }
 * }
 * const ReactiveClassComp = view(ClassComp);
 */
// 函数重载：支持函数组件和类组件
export function view<P = any>(Comp: ComponentType<P> & { prototype?: any }): ComponentType<P>;
export function view<P = any, S = any>(Comp: ComponentClass<P, S>): ComponentClass<P, S>;
export function view<P = any, S = any>(Comp: ComponentType<P>): ComponentType<P> {
  const isClassComp = isClassComponent(Comp);
  // 函数组件：直接使用 observer（observer 已经支持 forwardRef）
  if (!isClassComp) {
    return observer(Comp as any) as ComponentType<P>;
  }

  // 类组件：创建响应式包装类
  const BaseComp = Comp as ComponentClass<P, S>;

  class ReactiveClassComponent extends BaseComp {
    /**
     * 响应式 render 函数
     * 会在 observable 数据变化时自动触发组件更新
     * （declare + 构造器守护赋值，不能用类字段初始化 —— 用户构造函数
     * 若以 Object.freeze(this) 收尾，类字段的 defineProperty 会在
     * super() 返回后抛 TypeError，组件直接被构造期打崩）
     */
    declare private _reactiveRender: Reaction | null;

    /** 组件是否已 commit。commit 前的 render 不做依赖追踪（见 render 注释） */
    declare private _committed: boolean;

    /**
     * 首渲染的读取快照（commit 窗口的变更检测依据，见 _renderForMount）。
     * _onDidMount 消费后清空。
     */
    declare private _mountSnapshot: MountSnapshotEntry[] | null;

    constructor(props: P, context: any) {
      super(props, context);

      // 不可扩展实例（Object.preventExtensions/freeze）上连字段初值都
      // 写不进去 —— 降级为 undefined（与现有 null/false 判断兼容），
      // 组件以不可响应式形态继续存活。（完全 freeze 的实例连 React 自己
      // 的 updater 赋值都会失败，本就不属于可挂载场景。）
      try {
        this._reactiveRender = null;
        this._committed = false;
        this._mountSnapshot = null;
      } catch {
        if (process.env.NODE_ENV !== 'production') {
          try {
            console.warn(
              '[@rabjs/react] view: 组件实例被 preventExtensions/freeze 密封，' +
                '响应式追踪所需的内部字段无法初始化 —— 该组件将退化为普通组件' +
                '（不追踪 observable 变化）。'
            );
          } catch {
            // 日志失败同样不得影响挂载
          }
        }
      }

      // 注意：这里刻意不创建 reaction。构造函数/首渲染里创建并执行的
      // reaction 会立即向 store 注册依赖，而「渲染后被丢弃且永不 commit」
      // 的并发 pass 没有 componentWillUnmount，也没有 FinalizationRegistry
      // 兜底（store→reaction→实例构成自持引用环，registry 对任何环内目标
      // 都永不触发）——reaction 会永久泄漏并对死实例 forceUpdate。
      // 首次依赖追踪推迟到 componentDidMount 之后（见 render/_onDidMount）；
      // SSR 安全由时机保证：renderToString 不执行 componentDidMount，
      // render() 内的 isUsingStaticRendering 检查兜住静态渲染期间的直读。
      //
      // 字段重绑定与 static rendering 标志无关，必须无条件执行：构造期
      // 早退会让「构造时 flag 开启 + 箭头字段 cDM」的组件永久失去响应式
      // （#254）。重绑定不创建 reaction，SSR 安全。
      this._rebindShadowedLifecycleFields();
    }

    /**
     * 用户以箭头函数字段声明生命周期（componentDidMount = () => {...}）时，
     * 该字段是实例自身属性，遮蔽本类原型上的同名方法——React 只调用实例
     * 字段，包装器的 reaction 复活/清理逻辑会被完全跳过（super.* 转发根本
     * 不会执行）。super() 返回时用户类字段已完成初始化（useDefineForClassFields
     * 两种编译模式下都是实例自身属性），这里把被遮蔽的字段原地替换为
     * 「先执行用户字段、再执行包装器逻辑」的组合。
     * 以原型方法声明的用户没有实例自身字段，本方法不做任何事。
     *
     * 组合函数带 COMPOSED_BY_VIEW 品牌：class Sub extends view(Base) 时，
     * 子类字段初始化在 super()（即本构造函数）之后才执行，会覆盖掉这里
     * 组合好的字段 —— 首渲染（_renderForMount）会再次调用本方法，凭品牌
     * 识别出被覆盖的字段并重新组合（被覆盖丢失的基类用户字段逻辑与
     * 无 view 时的 JS 字段遮蔽语义一致，不额外补偿）。
     */
    private _rebindShadowedLifecycleFields(): void {
      const self = this as unknown as Record<string, unknown>;
      // 实例被完全 freeze 时下面的字段赋值会在 strict mode 抛 TypeError
      // —— 不得让包装器成为额外的崩溃点（React 自身对 freeze 实例本就
      // 无法挂载，这里只是防御）。失败代价是退回「字段遮蔽」旧行为
      // （StrictMode/Suspense 路径上可能失去响应式）。
      try {
        if (
          Object.prototype.hasOwnProperty.call(this, 'componentDidMount') &&
          typeof self.componentDidMount === 'function' &&
          !(self.componentDidMount as any)[COMPOSED_BY_VIEW]
        ) {
          const userDidMount = self.componentDidMount as (this: unknown) => void;
          const composed = () => {
            userDidMount.call(this);
            this._onDidMount();
          };
          (composed as any)[COMPOSED_BY_VIEW] = true;
          self.componentDidMount = composed;
        }
        if (
          Object.prototype.hasOwnProperty.call(this, 'componentWillUnmount') &&
          typeof self.componentWillUnmount === 'function' &&
          !(self.componentWillUnmount as any)[COMPOSED_BY_VIEW]
        ) {
          const userWillUnmount = self.componentWillUnmount as (this: unknown) => void;
          const composed = () => {
            try {
              userWillUnmount.call(this);
            } finally {
              // 用户字段抛错也必须释放 reaction —— React 在 cWU 抛错后
              // 依然完成卸载，跳过清理就是确定性的订阅泄漏
              this._releaseReaction();
            }
          };
          (composed as any)[COMPOSED_BY_VIEW] = true;
          self.componentWillUnmount = composed;
        }
      } catch {
        /* 构造器的字段初值守护已发警告，此处静默降级即可 */
      }
    }

    /**
     * 创建响应式 render
     * 当 render 中访问的 observable 数据变化时，会触发 scheduler
     */
    private _createReactiveRender(): Reaction {
      // 保存原始 render 方法（super.render 获取基类的 render）
      const originalRender = super.render.bind(this);

      return observe(originalRender, {
        // 使用 lazy 模式，不立即执行
        lazy: true,
        // 当 observable 变化时，通过 forceUpdate 触发组件更新。
        // 必须用 forceUpdate 而不是 setState({})：forceUpdate 绕过
        // shouldComponentUpdate，用户 SCU 返回 false 时不会吞掉响应式
        // 刷新；用户 SCU 只拦截 props / 自身 state 触发的更新 (#198)
        scheduler: () => {
          notifyReactStore(() => {
            this.forceUpdate();
          });
        },
      });
    }

    /**
     * 重写 render 方法
     * 在响应式上下文中执行原始 render
     */
    render(): React.ReactNode {
      // SSR：构造时就未建 reaction，直接执行原始 render
      if (isUsingStaticRendering()) {
        return super.render();
      }
      // 组件尚未 commit（首渲染，或将被丢弃的并发/挂起 pass）：裸执行原始
      // render，不做依赖追踪。追踪即向 store 注册；被丢弃且永不 commit 的
      // pass 没有 cWU 可清理，reaction 会永久泄漏。commit 后的首次依赖收集
      // 由 componentDidMount 建 reaction 完成（见 _onDidMount）。
      if (!this._committed) {
        return this._renderForMount();
      }
      // componentWillUnmount 会 unobserve 并置空 reaction，但 StrictMode
      // 模拟卸载 / Suspense 隐藏→显示都会走 cWU 而不销毁实例——实例存活、
      // reaction 已死，不重建则降级路径（裸执行 render）不再建立依赖，
      // 组件从此静默失去响应式。unobserved 检查同理（首跑失败被
      // runAsReaction 自动脱管的死 reaction）。
      if (!this._reactiveRender || this._reactiveRender.unobserved) {
        this._reactiveRender = this._createReactiveRender();
      }
      // 在 reaction 中执行 render，建立依赖追踪
      // reaction 是一个函数，调用它会执行传入 observe 的函数
      return this._reactiveRender();
    }

    /**
     * commit 前的 render：裸执行，但用一次性探针 reaction 记录读取快照。
     *
     * 探针在 render 结束的 finally 里立即 unobserve —— 注册生命周期不超出
     * 本次 render 调用，被丢弃的并发 pass 不会泄漏任何订阅。快照（读了哪些
     * observable 位置、当时读到的值）留给 _onDidMount 做 commit 窗口的
     * 变更检测：窗口内（自身/子组件/兄弟组件的 cDM 等）对依赖的写入发生时
     * 还没有 reaction 订阅，会被静默丢弃，没有快照对比就会让 DOM 永久停留
     * 在首渲染的旧值上。
     *
     * 顺带重新组合被遮蔽的生命周期字段：class Sub extends view(Base) 时
     * 子类字段初始化晚于包装器构造函数，构造期的组合会被覆盖，这里（字段
     * 初始化必然已完成、React 尚未调用任何生命周期）是重新组合的最早时机。
     */
    private _renderForMount(): React.ReactNode {
      this._rebindShadowedLifecycleFields();

      const snapshot: MountSnapshotEntry[] = [];
      const recordRead = Object.assign(
        (operation: { target: object; key: PropertyKey; type: string }) => {
          snapshot.push({
            target: operation.target,
            key: operation.key,
            type: operation.type,
            value: readSnapshotValue(operation.target, operation.key, operation.type),
          });
        },
        {
          // 不消费 oldValue —— 避免 clear() 等操作为本探针付 O(n) 快照成本
          wantsOldValue: false,
          // 只读 raw target + push 数组，绝不写 observable —— 声明
          // reentrantSafe 后，在 isDebugging 重入窗口（某个 reaction 的
          // debugger 执行期间同步完成的首挂载）内读取记录仍然送达；
          // 否则窗口内挂载的组件快照为空，commit 窗口的变更检测被架空
          // （与 @Memo 同步失效钩子的 reentrantSafe 同一先例）。
          reentrantSafe: true,
        }
      );

      const probe = observe(() => super.render(), {
        lazy: true,
        // render 期间的写入不会调度本探针（reaction 在运行栈上会被跳过），
        // noop scheduler 只是保险，绝不允许默认的同步重跑语义
        scheduler: () => {},
        debugger: recordRead,
      });
      try {
        return probe();
      } finally {
        unobserve(probe);
        try {
          this._mountSnapshot = snapshot;
        } catch {
          /* 密封实例：降级为无快照（_onDidMount 的 _committed 赋值同样会失败） */
        }
      }
    }

    /**
     * 组件挂载 / StrictMode 模拟重挂载 / Suspense 隐藏→显示 时恢复 reaction
     */
    componentDidMount(): void {
      if (super.componentDidMount) {
        super.componentDidMount();
      }

      this._onDidMount();
    }

    /**
     * commit 落点：开启依赖追踪。
     * 首渲染是裸执行的（见 render），这里创建 reaction 并同步执行一次，
     * 让 render 在 reaction 中运行以完成首次依赖收集（输出丢弃，不产生
     * 额外 commit）；componentWillUnmount 会 unobserve 并置空 reaction，
     * 但 StrictMode 模拟卸载、Suspense/Offscreen 隐藏→显示都会走 cWU
     * 而不销毁实例，且该路径只重放 cDM、不再触发 render——同样由本方法
     * 负责复活。
     */
    private _onDidMount(): void {
      // 冻结实例上写字段会抛 TypeError —— 降级跳过响应式恢复
      // （构造器重绑失败时已发 dev 警告）
      try {
        this._committed = true;
      } catch {
        return;
      }
      // 取出首渲染的读取快照（一次性消费）
      const snapshot = this._mountSnapshot;
      try {
        this._mountSnapshot = null;
      } catch {
        /* _committed 赋值已成功，此处不可达；防御而已 */
      }
      if (!this._reactiveRender || this._reactiveRender.unobserved) {
        const reaction = this._createReactiveRender();
        try {
          this._reactiveRender = reaction;
        } catch {
          return;
        }
        if (snapshot && isMountSnapshotStale(snapshot)) {
          // commit 窗口内（自身/子组件 cDM 等）依赖已变化：同步收集渲染的输出
          // 已不等于刚 commit 的首渲染，「丢弃输出」假设不成立 —— forceUpdate
          // 让 render 阶段重跑（顺带完成依赖收集），DOM 反映新值。错误按
          // render 语义抛出（错误边界行为与 master 一致），cDU 触发是正当的
          // （数据确实在挂载过程中变了），不属于伪 update。
          this.forceUpdate();
          return;
        }
        if (!snapshot) {
          // cDM 重放（StrictMode 模拟重挂载 / Suspense·Offscreen 隐藏→显示）
          // 没有伴随 render，没有快照可比对 —— 隐藏/卸载窗口内的依赖变化
          // 无从检测。按 master 语义无条件 forceUpdate：render 阶段重跑
          // （顺带完成复活 reaction 的首次依赖收集），DOM 反映当前值，
          // 不停留在隐藏前的旧值上。
          this.forceUpdate();
          return;
        }
        // 不 forceUpdate：窗口内无变化时，首次依赖收集直接同步执行一次
        // reaction 即可（render 在追踪中再跑一遍，输出与刚 commit 的首渲染
        // 相同，直接丢弃）。forceUpdate 会把「挂载」变成一次 update commit ——
        // render 走完整双 commit，且 componentDidUpdate /
        // getSnapshotBeforeUpdate 会紧随 mount 被触发（prevProps ===
        // props），未做挂载防护的用户副作用被 spurious 执行。
        reaction();
      }
    }

    /**
     * 优化 shouldComponentUpdate
     * 只在 props 或 state 变化时更新
     * observable 的变化通过 scheduler 的 forceUpdate 触发，绕过本方法，
     * 因此用户自定义 SCU 不会吞掉响应式刷新 (#198)
     */
    shouldComponentUpdate(
      nextProps: Readonly<P>,
      nextState: Readonly<S>,
      nextContext: any
    ): boolean {
      // 如果用户定义了 shouldComponentUpdate，优先使用
      if (super.shouldComponentUpdate) {
        return super.shouldComponentUpdate(nextProps, nextState, nextContext);
      }

      const { props, state } = this;

      // state 变化时更新（包括 scheduler 触发的空 setState）
      if (state !== nextState) {
        return true;
      }

      // props 浅比较
      const keys = Object.keys(props as any);
      const nextKeys = Object.keys(nextProps as any);

      if (nextKeys.length !== keys.length) {
        return true;
      }

      // 检查每个 prop 是否变化
      return nextKeys.some(key => (props as any)[key] !== (nextProps as any)[key]);
    }

    /**
     * 组件卸载时清理 reaction
     */
    componentWillUnmount(): void {
      // 先调用用户定义的 componentWillUnmount；用户方法抛错也必须释放
      // reaction —— React 在 cWU 抛错后依然完成卸载，跳过清理就是确定性
      // 的订阅泄漏（与箭头字段路径的 try/finally 组合一致）
      try {
        if (super.componentWillUnmount) {
          super.componentWillUnmount();
        }
      } finally {
        this._releaseReaction();
      }
    }

    /**
     * 清理 reaction，释放内存
     */
    private _releaseReaction(): void {
      // cWU 之后实例未必销毁（StrictMode 模拟卸载 / Suspense·Offscreen 隐藏）：
      // 重置 _committed，让后续 render 回到 commit 前的探针路径 —— 隐藏树被
      // props/context 驱动重渲染时若在 committed 路径重建并执行存活 reaction，
      // 而子树随后在隐藏中被删除（React 不重放 cWU），reaction 永不 unobserve，
      // 与首渲染泄漏同类。探针渲染不留下任何订阅（render 结束即 unobserve），
      // reveal 的 cDM 重放再由 _onDidMount 消费其快照。
      // 冻结实例上写字段会抛 —— 降级尽力而为。
      try {
        this._committed = false;
      } catch {
        /* frozen instance */
      }
      if (this._reactiveRender) {
        unobserve(this._reactiveRender);
        // 冻结实例上写字段会抛 —— unobserve 已完成清理目的，置空尽力而为
        try {
          this._reactiveRender = null;
        } catch {
          /* frozen instance */
        }
      }
    }
  }

  // 继承 displayName
  ReactiveClassComponent.displayName = Comp.displayName || Comp.name;

  // 复制静态属性
  copyStaticProperties(Comp, ReactiveClassComponent);

  // 标记组件已被 view 包裹
  (ReactiveClassComponent as any)[IS_REACTIVE_COMPONENT] = true;

  return ReactiveClassComponent as ComponentClass<P, S>;
}

/**
 * 复制静态属性
 * 基于 hoist-non-react-statics
 */
const hoistBlackList: Record<string, boolean> = {
  $$typeof: true,
  render: true,
  compare: true,
  type: true,
  displayName: true,
  // React 内部属性
  childContextTypes: true,
  contextType: true,
  contextTypes: true,
  defaultProps: true,
  getDefaultProps: true,
  getDerivedStateFromError: true,
  getDerivedStateFromProps: true,
  mixins: true,
  propTypes: true,
};

function copyStaticProperties(base: any, target: any): void {
  for (const key of Object.keys(base)) {
    if (!hoistBlackList[key]) {
      const descriptor = Object.getOwnPropertyDescriptor(base, key);
      if (descriptor) {
        Object.defineProperty(target, key, descriptor);
      }
    }
  }
}
