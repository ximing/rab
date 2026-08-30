# @rabjs/rn-debug-server

## 9.3.5

## 9.3.4

## 9.3.3

## 9.3.2

### Patch Changes

- unify all @rabjs packages to a single 9.3.2 version; future bumps stay in lockstep via changesets fixed

## 0.2.1

### Patch Changes

- 7621c98: esbuild 0.28 with es2020 targets; rn-debug-server reports the actual listen port

## 0.2.0

### Minor Changes

- 5a86704: rab-rn-debug：Agent 远程调试 React Native 应用的新包首发。

  - `@rabjs/rn-debug-server`：本地调试服务 CLI（`rab-rn-debug`），Agent 经 HTTP 发指令（同步 pending、每设备串行），RN 设备经 WebSocket 接入；内置调试页面（设备状态 / 指令流水 / console 日志实时流）
  - `@rabjs/rn-debug`：RN 端 Debug SDK，`setupRNDebug({ host, port })` 接入（仅 `__DEV__` 生效），内置 `ping` / `device.info` / `console.getLogs` / `rab.listServices` / `rab.getServiceState` / `rab.callServiceMethod` / `rab.expect` 指令，支持 `registerHandler` 自定义指令
  - 新增 skill：`skills/rab-rn-debug/SKILL.md`（Agent 使用指南）
