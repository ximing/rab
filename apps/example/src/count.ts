import { Injectable, Service } from '@rabjs/core';

@Injectable()
export class CountService extends Service {
  count = 0;
  start = 0;

  add(count: number) {
    this.count += count;
  }

  setCount(count: number) {
    this.count = count;
  }

  async minus(count: number) {
    this.count -= count;
  }
}
