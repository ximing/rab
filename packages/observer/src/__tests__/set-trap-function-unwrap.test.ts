/**
 * G5 第 3 轮对抗审查 issue #6：base/shadow 对象 set trap 的 value 解包
 * 守卫未对齐 toRawIfProxy（object || function）
 *
 * 现状（RED）：`state.data = observable(fn)` 后 raw(state).data 存的是
 * **function proxy**，而集合 trap（m.set('k', fnProxy)）已统一存 raw ——
 * 同一 commit message 自述要消除的『raw 结构中残留 proxy 的身份分裂』
 * 在对象 set trap 的函数分支上仍存在。round-trip 身份仍成立
 * （state.data === fnProxy，observableChild 幂等），故非功能错误，
 * 但应与 a1fd53d 的 toRawIfProxy 对齐。
 */

import { observable, shadowObservable, raw } from "../main";

describe("set trap function unwrap alignment (G5 review round 3, issue 6)", () => {
  test("base set trap: 赋 observable 函数 proxy 时内部必须存 raw", () => {
    const fn = () => {};
    const fnProxy = observable(fn);
    expect(fnProxy).not.toBe(fn); // 确保确实是 proxy（而非 shouldInstrument 拒绝包装）

    const state = observable<{ data: unknown }>({ data: null });
    state.data = fnProxy;

    // 往返身份保持（get 经 observableChild 命中缓存 proxy）
    expect(state.data).toBe(fnProxy);
    // 内部 raw 落盘（不变量：raw 结构不持有 proxy）
    expect(raw(state).data).toBe(fn);
  });

  test("shadow set trap: 赋 observable 函数 proxy 时内部必须存 raw", () => {
    const fn = () => {};
    const fnProxy = observable(fn);

    const state = shadowObservable<{ data: unknown }>({ data: null });
    state.data = fnProxy;

    // shadow get 不包装，直接返回落盘值 —— 若落盘是 proxy，这里会露出 proxy
    expect(state.data).toBe(fn);
    expect(raw(state).data).toBe(fn);
  });

  test("对象 value 的既有解包行为不受影响（对照）", () => {
    const objVal = { a: 1 };
    const objProxy = observable(objVal);
    const state = observable<{ data: unknown }>({ data: null });
    state.data = objProxy;
    expect(raw(state).data).toBe(objVal);
    expect(state.data).toBe(objProxy);
  });
});
