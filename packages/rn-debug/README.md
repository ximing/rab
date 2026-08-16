# @rabjs/rn-debug

RABjs React Native 调试 SDK。长连接 `@rabjs/rn-debug-server`，接收指令顺序执行并回传结果。

## 使用

```ts
import { setupRNDebug, registerHandler } from '@rabjs/rn-debug';

// App 入口（仅 __DEV__ 生效，生产 no-op）
setupRNDebug({
  host: '192.168.1.5', // 电脑局域网 IP（server 启动时会打印）
  port: 9229,
  appName: 'MyApp',
});

// 可选：注册自定义指令
registerHandler('app.gotoScreen', async ({ name }) => {
  navigationRef.navigate(name);
  return { current: name };
});
```

## 内置指令

| type | payload | 说明 |
|------|---------|------|
| ping | — | 连通性 |
| device.info | — | 设备与应用信息 |
| console.getLogs | `{level?, limit?}` | 拉取设备端 console 日志（环形 500 条） |
| rab.listServices | — | 枚举已实例化 Service |
| rab.getServiceState | `{instanceId?, identifierLabel?, paths?}` | 读取 Service 状态 |
| rab.callServiceMethod | `{instanceId, method, args?}` | 调用 Service 方法 |
| rab.expect | `{instanceId, description?, assertions[]}` | 断言（op 与 @rabjs/devtools 一致） |

配合 `npx rab-rn-debug` 使用，详见 server 包 README。
