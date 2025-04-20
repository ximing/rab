import { Service } from '@rabjs/core';

@Service()
export class AppService {
  count = 0;
  add(value: number) {
    this.count += value;
  }
}
