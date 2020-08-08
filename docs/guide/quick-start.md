---
title: 快速上手(Hooks)
order: 0
nav:
  title: 文档
  order: 1
---

# 快速上手

## 新建 Web 项目

```bash
npx create-react-app my-app  --typescript
cd my-app
npm start
```

## 添加依赖

```bash
$ npm i --S @rabjs/core inversify reflect-metadata
```

在项目入口文件处，导入 reflect-metadata，如 app.tsx 中

```typescript
import 'reflect-metadata';
```

## 创建一个 demo modules

```bash
mkdir src/modules src/modules/demo
```

在 src/modules/demo 下新建一个 demo.service 文件和 demo.tsx 模块入口文件

```typescript
// demo.service.ts
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
```

注意 Demo 组件需要使用 `view函数` 包裹起来，这样 Demo 组件就可以直接通过 Service 内状态的变化做出响应的反应

```typescript jsx
// demo.tsx
import React from 'react';
import { view, useService } from '@rabjs/core';
import { DemoService } from './demo.service';

export const Demo = view(() => {
  const demoService = useService(DemoService);
  return (
    <div>
      <p>demoFC:</p>
      <button
        onClick={() => {
          demoService.count += 1;
        }}
      >
        click
      </button>
      demo count{demoService.count}
    </div>
  );
});
```

app.tsx 中引入 demo/demo.tsx 即可

```typescript jsx
import Demo from './modules/demo/demo'
function App() {
    return(
        ...
        <Demo/>
        ...
    )
}
```
