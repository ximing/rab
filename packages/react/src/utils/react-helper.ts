// 标志：标记组件已被 observer 或 view 包裹
export const IS_REACTIVE_COMPONENT = Symbol.for('@rabjs/react:isReactiveComponent');

/**
 * 判断是否为类组件
 */
export function isClassComponent(Comp: any): boolean {
  return !!(Comp.prototype && Comp.prototype.isReactComponent);
}

/**
 * 检测组件是否已经被 observer 或 view 包裹过
 * 通过检查 IS_REACTIVE_COMPONENT 标志来判断
 */
export function isAlreadyWrapped(Comp: any): boolean {
  return (Comp as any)[IS_REACTIVE_COMPONENT] === true;
}
