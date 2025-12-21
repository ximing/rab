import { observable } from './observable';
import { rawToOptions } from './proxyRawMap';
import { isObject } from './utils';

/*
 * 设计思路是为了减少对嵌套对象的递归包装，避免性能问题，lazy 包装
 * */
export function observableChild<T>(child: T, parent: object): T {
  if (isObject(child) || typeof child === 'function') {
    // 递归包装: 将嵌套对象也转换为 observable
    // 继承配置: 子对象继承父对象的 options
    // 深度追踪: 实现对嵌套属性的响应式追踪
    const options = rawToOptions.get(parent);
    return observable(child as object, options) as T;
  }
  return child;
}
