/**
 * view HOC - 支持函数组件和类组件的响应式包装器
 *
 * 函数组件：使用 observer 实现（基于 Hooks + useSyncExternalStore）
 * 类组件：使用 observe + forceUpdate 实现
 */
import { observe, unobserve, type Reaction } from '@rabjs/observer';
import { Component, ComponentType, ComponentClass } from 'react';

import { observer, IS_REACTIVE_COMPONENT } from './observer';

/**
 * 判断是否为类组件
 */
function isClassComponent(Comp: any): boolean {
  return !!(Comp.prototype && Comp.prototype.isReactComponent);
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
     */
    private _reactiveRender: Reaction | null = null;

    constructor(props: P, context: any) {
      super(props, context);

      // 保存原始 render 方法（在这里调用 super.render 获取基类的 render）
      const originalRender = super.render.bind(this);

      // 创建响应式 render
      // 当 render 中访问的 observable 数据变化时，会触发 scheduler
      this._reactiveRender = observe(originalRender, {
        // 使用 lazy 模式，不立即执行
        lazy: true,
        // 当 observable 变化时，通过 setState 触发组件更新
        scheduler: () => {
          // 使用 setState 触发重新渲染
          // 传入空对象，不改变 state，只触发更新
          this.setState({});
        },
      });
    }

    /**
     * 重写 render 方法
     * 在响应式上下文中执行原始 render
     */
    render(): React.ReactNode {
      if (this._reactiveRender) {
        // 在 reaction 中执行 render，建立依赖追踪
        // reaction 是一个函数，调用它会执行传入 observe 的函数
        return this._reactiveRender();
      }
      // 降级：如果 reaction 未创建，直接执行原始 render
      return super.render();
    }

    /**
     * 优化 shouldComponentUpdate
     * 只在 props 或 state 变化时更新
     * observable 的变化通过 scheduler 触发，不需要在这里处理
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

      // 清理 reaction，释放内存
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
  Object.keys(base).forEach(key => {
    if (!hoistBlackList[key]) {
      const descriptor = Object.getOwnPropertyDescriptor(base, key);
      if (descriptor) {
        Object.defineProperty(target, key, descriptor);
      }
    }
  });
}
