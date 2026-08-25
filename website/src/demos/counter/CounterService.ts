import { Service } from '@rabjs/react';

/**
 * 计数器 Service —— 最小示例
 *
 * 约定：
 * - 继承 Service 后，所有属性自动变为 observable；
 * - 所有方法默认就是 Action，无需任何装饰器。
 */
export class CounterService extends Service {
  count = 0;

  increment() {
    this.count += 1;
  }

  decrement() {
    this.count -= 1;
  }
}
