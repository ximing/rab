/**
 * view HOC - 支持函数组件和类组件的响应式包装器
 *
 * 函数组件：使用 observer 实现（基于 Hooks + useSyncExternalStore）
 * 类组件：使用 observe + forceUpdate 实现
 */
import { observe, unobserve, type Reaction } from '@rabjs/observer';
import { ComponentType, ComponentClass } from 'react';

import { observer } from './observer';
import { isUsingStaticRendering } from './static-rendering';
import { notifyReactStore } from './utils/notify-react-store';
import { IS_REACTIVE_COMPONENT, isClassComponent } from './utils/react-helper';

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
     */
    private _reactiveRender: Reaction | null = null;

    /** 组件是否已 commit。commit 前的 render 不做依赖追踪（见 render 注释） */
    private _committed = false;

    constructor(props: P, context: any) {
      super(props, context);

      // SSR：不建 reaction。renderToString 不会 unmount，否则会泄漏订阅。
      if (isUsingStaticRendering()) {
        return;
      }

      // 注意：这里刻意不创建 reaction。构造函数/首渲染里创建并执行的
      // reaction 会立即向 store 注册依赖，而「渲染后被丢弃且永不 commit」
      // 的并发 pass 没有 componentWillUnmount，也没有 FinalizationRegistry
      // 兜底（store→reaction→实例构成自持引用环，registry 对任何环内目标
      // 都永不触发）——reaction 会永久泄漏并对死实例 forceUpdate。
      // 首次依赖追踪推迟到 componentDidMount 之后（见 render/_onDidMount）。
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
     */
    private _rebindShadowedLifecycleFields(): void {
      const self = this as unknown as Record<string, unknown>;
      if (Object.prototype.hasOwnProperty.call(this, 'componentDidMount')) {
        const userDidMount = self.componentDidMount as (this: unknown) => void;
        self.componentDidMount = () => {
          userDidMount.call(this);
          this._onDidMount();
        };
      }
      if (Object.prototype.hasOwnProperty.call(this, 'componentWillUnmount')) {
        const userWillUnmount = self.componentWillUnmount as (this: unknown) => void;
        self.componentWillUnmount = () => {
          userWillUnmount.call(this);
          this._releaseReaction();
        };
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
      // 由 componentDidMount 建 reaction 并 forceUpdate 的那次 render 完成
      // （在浏览器绘制前同步发生，UI 无感知）。
      if (!this._committed) {
        return super.render();
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
     * 首渲染是裸执行的（见 render），这里创建 reaction 并强制重跑一次
     * 渲染，让 render 在 reaction 中执行以完成首次依赖收集；
     * componentWillUnmount 会 unobserve 并置空 reaction，但 StrictMode
     * 模拟卸载、Suspense/Offscreen 隐藏→显示都会走 cWU 而不销毁实例，
     * 且该路径只重放 cDM、不再触发 render——同样由本方法负责复活。
     */
    private _onDidMount(): void {
      this._committed = true;
      if (!this._reactiveRender || this._reactiveRender.unobserved) {
        this._reactiveRender = this._createReactiveRender();
        this.forceUpdate();
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
      // 先调用用户定义的 componentWillUnmount
      if (super.componentWillUnmount) {
        super.componentWillUnmount();
      }

      this._releaseReaction();
    }

    /**
     * 清理 reaction，释放内存
     */
    private _releaseReaction(): void {
      if (this._reactiveRender) {
        unobserve(this._reactiveRender);
        this._reactiveRender = null;
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
