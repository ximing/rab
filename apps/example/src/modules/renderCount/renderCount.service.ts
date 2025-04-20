import { Service } from '@rabjs/core';

@Service()
export class RenderCount {
  count = 0;
  start = 0;

  add(count: number) {
    this.count += count;
  }

  changeStart() {
    console.error('---->', this);
    this.start += 1;
  }

  setCount(count: number) {
    this.count = count;
  }

  async minus(count: number) {
    this.count -= count;
  }
}
