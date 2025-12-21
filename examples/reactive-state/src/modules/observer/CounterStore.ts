/**
 * 计数器 Store - 用于演示 observer 和 useObserver
 */
import { observable } from '@rabjs/react';

export class CounterStore {
  count = 0;
  step = 1;

  increment() {
    this.count += this.step;
  }

  decrement() {
    this.count -= this.step;
  }

  setStep(step: number) {
    this.step = step;
  }

  reset() {
    this.count = 0;
    this.step = 1;
  }
}

// 创建全局单例
export const counterStore = observable(new CounterStore());
