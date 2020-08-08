---
title: 异步状态处理
order: 2
---

通过 `useService` 等方式获取的 service 实例会多一个 `$model` 的状态，如果 service 中是一个异步的方法，那么在`$model`中会有一个同名的对象，对象中包含 loading 和 error 两个值，当触发这个异步方法的时候，loading 会被 RabJS 置为 true，当异步方法完成时会被置为 false，如果异步方法抛出异常，error 将被赋为这个被抛出的错误，这在做一些列表加载动画的时候很有用

### 事例

```typescript
import { Service, Injectable, useService } from '@rabjs/core';
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

const Page = () => {
  const demoService = useService(DemoService);
  if (demoService.$model.addAsync.loading) {
    return <Loading />;
  }
  if (demoService.$model.addAsync.error) {
    return demoService.$model.addAsync.error.message;
  }
  return <View>success</View>;
};
```
