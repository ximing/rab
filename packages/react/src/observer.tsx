/**
 * observer HOC - 将函数组件转换为响应式组件
 * 参考 mobx-react-lite 实现，支持 React 并发模式和严格模式
 */
import type { Operation } from "@rabjs/observer";
import { forwardRef, memo } from "react";
import type React from "react";

import { isUsingStaticRendering } from "./static-rendering";
import { useObserver } from "./use-observer";
import { IS_REACTIVE_COMPONENT } from "./utils/react-helper";

let warnLegacyContextTypes = true;

const hasSymbol = typeof Symbol === "function" && Symbol.for;
const isFunctionNameConfigurable =
  Object.getOwnPropertyDescriptor(() => {}, "name")?.configurable ?? false;

// 使用 react-is 有一些问题（并且操作元素而不是类型），参见 #608 / #609
const ReactForwardRefSymbol = hasSymbol
  ? Symbol.for("react.forward_ref")
  : typeof forwardRef === "function" &&
    forwardRef((props: any) => null)["$$typeof"];

const ReactMemoSymbol = hasSymbol
  ? Symbol.for("react.memo")
  : typeof memo === "function" && memo((props: any) => null)["$$typeof"];

/**
 * observer HOC 选项
 */
export interface ObserverOptions {
  debugger?: (operation: Operation) => void;
}

// 函数重载：支持不同的组件类型
export function observer<P extends object, TRef = {}>(
  baseComponent: React.FunctionComponent<P>,
  options?: ObserverOptions
): React.MemoExoticComponent<
  React.ForwardRefExoticComponent<
    React.PropsWithoutRef<P> & React.RefAttributes<TRef>
  >
>;

export function observer<P extends object, TRef = {}>(
  baseComponent: React.ForwardRefExoticComponent<
    React.PropsWithoutRef<P> & React.RefAttributes<TRef>
  >,
  options?: ObserverOptions
): React.MemoExoticComponent<
  React.ForwardRefExoticComponent<
    React.PropsWithoutRef<P> & React.RefAttributes<TRef>
  >
>;

// 基本实现
export function observer<P extends object, TRef = {}>(
  baseComponent:
    | React.ForwardRefRenderFunction<TRef, P>
    | React.FunctionComponent<P>
    | React.ForwardRefExoticComponent<
        React.PropsWithoutRef<P> & React.RefAttributes<TRef>
      >,
  options?: ObserverOptions
) {
  if (
    ReactMemoSymbol &&
    (baseComponent as any)["$$typeof"] === ReactMemoSymbol
  ) {
    throw new Error(
      `[@rabjs/react] 你正在尝试在已经被 \`observer\` 或 \`React.memo\` 包装的函数组件上使用 \`observer\`。observer 已经为你应用了 'React.memo'。`
    );
  }

  if (isUsingStaticRendering()) {
    return baseComponent;
  }

  let useForwardRef = false;
  let render = baseComponent;

  const baseComponentName = baseComponent.displayName || baseComponent.name;

  // 如果已经用 forwardRef 包装，解包，
  // 以便我们可以修补 render 并应用 memo
  if (
    ReactForwardRefSymbol &&
    (baseComponent as any)["$$typeof"] === ReactForwardRefSymbol
  ) {
    useForwardRef = true;
    render = (baseComponent as any)["render"];
    if (typeof render !== "function") {
      throw new TypeError(
        `[@rabjs/react] ForwardRef 的 \`render\` 属性不是函数`
      );
    }
  }

  let observerComponent = (props: any, ref: React.Ref<TRef>) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useObserver(() => render(props, ref), baseComponentName, options);
  };

  // 继承原始名称和 displayName，参考 https://github.com/mobxjs/mobx/issues/3438
  // React 19 的 FunctionComponent 不再声明 contextTypes，这里用 any 保留运行时兼容。
  (observerComponent as any).displayName = baseComponent.displayName;

  if (isFunctionNameConfigurable) {
    Object.defineProperty(observerComponent, "name", {
      value: baseComponent.name,
      writable: true,
      configurable: true,
    });
  }

  // 支持旧版 context：contextTypes 必须在 memo 之前应用
  if ((baseComponent as any).contextTypes) {
    (observerComponent as any).contextTypes = (baseComponent as any).contextTypes;

    if (process.env.NODE_ENV !== "production" && warnLegacyContextTypes) {
      warnLegacyContextTypes = false;
      console.warn(
        `[@rabjs/react] 函数组件中对旧版 Context 的支持将在下一个主要版本中删除。`
      );
    }
  }

  // 总是使用 forwardRef 包装，以支持 ref 转发
  // forwardRef 必须在 memo 之前应用
  // React 19 的 ReactNode 包含 Promise，与 ForwardRefRenderFunction 返回值不完全兼容，
  // 运行时行为不变，这里收窄类型以便通过检查。
  const forwarded = forwardRef(
    observerComponent as React.ForwardRefRenderFunction<TRef, any>
  );
  const memoized = memo(forwarded);

  copyStaticProperties(baseComponent, memoized);

  // 标记组件已被 observer 包裹
  (memoized as any)[IS_REACTIVE_COMPONENT] = true;

  if (process.env.NODE_ENV !== "production") {
    Object.defineProperty(memoized, "contextTypes", {
      set() {
        throw new Error(
          `[@rabjs/react] \`${
            this.displayName ||
            this.type?.displayName ||
            this.type?.name ||
            "Component"
          }.contextTypes\` 必须在应用 \`observer\` 之前设置。`
        );
      },
    });
  }

  return memoized;
}

// 基于 https://github.com/mridgway/hoist-non-react-statics/blob/master/src/index.js
const hoistBlackList: any = {
  $$typeof: true,
  render: true,
  compare: true,
  type: true,
  // 不要重新定义 displayName，
  // 它在 memo 上定义为 getter-setter 对（参见 #3192）
  displayName: true,
};

function copyStaticProperties(base: any, target: any) {
  for (const key of Object.keys(base)) {
    if (!hoistBlackList[key]) {
      Object.defineProperty(
        target,
        key,
        Object.getOwnPropertyDescriptor(base, key)!
      );
    }
  }
}
