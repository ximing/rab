import { Action, Service } from "@rabjs/react";

/**
 * 计数器 Service —— 最小示例
 *
 * 约定：
 * - 继承 Service 后，所有属性自动变为 observable；
 * - 所有方法默认就是 Action（这里显式标出 @Action 仅为示意，
 *   同时它也验证了站点构建对 legacy 装饰器的支持）。
 */
export class CounterService extends Service {
  count = 0;

  @Action
  increment() {
    this.count += 1;
  }

  @Action
  decrement() {
    this.count -= 1;
  }
}
