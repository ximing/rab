import { Service, Injectable } from '@rabjs/core';

@Injectable()
export class DemoService extends Service {
  count = 0;
  async addAsync(num: number) {
    await new Promise((resolve) => {
      setTimeout(resolve, 1000);
    });
    this.count += num;
  }
}
