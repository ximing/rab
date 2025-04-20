import { Service } from '@rabjs/core';

@Service()
export class RenderCount {
  count = 0;
  start = 0;

  add(count: number) {
    console.log('---->add', this.count);
    this.count += count;
    console.log('---->add2', this.count);
  }

  changeStart() {
    this.start += 1;
  }

  setCount(count: number) {
    this.count = count;
  }

  async minus(count: number) {
    this.count -= count;
  }
}
