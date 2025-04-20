import { Service } from '@rabjs/core';

@Service()
export class DemoService {
  count = 0;
  async addAsync(num: number) {
    await new Promise((resolve) => {
      setTimeout(resolve, 1000);
    });
    this.count += num;
  }
}
