import { ObservableOptions } from "./types";

/*
 * 反向映射 (proxy -> raw) 无歧义, deep 与 shadow 两种代理可以共用:
 * 同一 raw 即使有两个 proxy, 每个 proxy 也只对应这一个 raw。
 * */
export const proxyToRaw = new WeakMap<object, object>();

/*
 * 修复 #6: rawToProxy 曾是 deep/shadow 共享的正向缓存, 导致
 * "先 shadowObservable(raw) 再 observable(raw)" 直接拿回 shadow 代理
 * (深层响应静默失灵, options 也写不进去), 反之则破坏浅层语义。
 * 现按深度模式分桶, 同一 raw 可以同时持有 deep 与 shadow 两个代理。
 *
 * 注意: rawToProxy 这个历史导出名单前专指 shadow 桶
 * (shadowObservable 使用, 既有测试直接引用该名); deep 桶为 deepRawToProxy。
 * */
export const rawToProxy = new WeakMap<object, object>(); // shadow 模式缓存
export const deepRawToProxy = new WeakMap<object, object>(); // deep 模式缓存

/*
 * stores custom proxy handlers for observables
 * 仅 deep 模式 (observable()) 接收并写入 options; shadowObservable 不接收
 * options, 因此同一 raw 的 deep options 不会被 shadow 覆盖。
 * 子代理经 observableChild 继承的就是这里的 deep options。
 * */
export const rawToOptions = new WeakMap<object, ObservableOptions>();
