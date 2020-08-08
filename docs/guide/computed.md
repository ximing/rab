---
title: 计算属性
order: 3
---

## 计算属性

由于 service 是标准的 class，所以可以直接使用 class 的 get 来实现计算属性

### 事例

```typescript
import { Service, Injectable } from '@rabjs/core';

@Injectable()
export class DemoService extends Service {
  count = 0;

  get count1() {
    return this.count + 1;
  }
}
```
