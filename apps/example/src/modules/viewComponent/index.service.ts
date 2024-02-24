import { Service, Injectable } from '@rabjs/core';

@Injectable()
export class ViewComponentService extends Service {
  count = 0;
  start = 0;
  add(num: number) {
    this.count += num;
  }
}
