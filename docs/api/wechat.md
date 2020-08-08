---
title: wechat
order: 2
---

## wechat

### Install

```bash
npm i @rabjs/wechat
```

### usePageService

在 r2m 中，使用`usePageService`可以获取和页面绑定的服务实例，这个实例在同一个页面多开的时候，每个页面都是独立的一个服务实例，而且在每一个页面下的所有组件使用的是和页面同一个的`service`实例

考虑一种情况，小程序页面是可以多开的，如果使用`useService`来获取 service 实例，那默认是单例模式。就会导致多个页面共用一份状态，在某些不能共用状态的场景这可能会有一些问题，为了每个页面的状态互相独立，我们可以使用第二个参数 scope `useService(IndexService, { scope: Transient })` 来获取每个页面独有的 service 实例。但是这时候有一个新的问题，在单例模式下，页面和页面下的组件都可以直接使用`useService`获取共用的状态，但是如果使用`{scope: Transient}`那么页面和页面下的组件将会是不同的实例，比如：

```javascript
const ChildComp = () => {
  const indexService = useService(IndexService, { scope: Transient }); // 全新的实例
  return <View>子组件</View>;
};
const Page = () => {
  const indexService = useService(IndexService, { scope: Transient }); // 全新的实例
  return (
    <View>
      <ChildComp />
    </View>
  );
};
```

因为`{ scope: Transient }`的原因 Page 和 ChildComp 的 indexService 都是独立的实例，这其实不太符合我们的预期，我们希望这两个 indexService 是同一个。同时，不同的 Page 页面的 indexService 是不同的，这时候就可以使用 `usePageService`

#### 实例

```javascript
import { usePageService } from '@rabjs/wechat';
const ChildComp = () => {
  const indexService = usePageService(IndexService); // 整个页面内是唯一的
  return <View>子组件</View>;
};
const Page = () => {
  const indexService = usePageService(IndexService); // 整个页面内是唯一的
  return (
    <View>
      <ChildComp />
    </View>
  );
};
```

#### ts 定义

```typescript
export declare function usePageService<M extends Service>(
  ServiceIdentifier: ConstructorOf<M>
): ServiceResult<M>;
```

#### 参数

service 构造函数

#### 返回值

service 实例
