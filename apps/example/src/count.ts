import { Service } from '@rabjs/core';

@Service()
export class CountService {
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
