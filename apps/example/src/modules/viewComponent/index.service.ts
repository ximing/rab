import { Service } from '@rabjs/core';

@Service()
export class ViewComponentService {
  count = 0;
  start = 0;
  add(num: number) {
    this.count += num;
  }
}
