/**
 * 修复 #6: rawToProxy 缓存按深度模式 (deep / shadow) 分桶
 *
 * 之前 shadowObservable 与 observable 共用同一个 rawToProxy WeakMap:
 * - 先 shadowObservable(raw) 再 observable(raw) 会拿回 shadow 代理,
 *   深层响应式静默失灵, 且 options (reactionHandlers) 也永远写不进去;
 * - 先 observable(raw) 再 shadowObservable(raw) 会拿回 deep 代理,
 *   浅层语义被破坏 (嵌套对象内部属性变更也会触发 reaction)。
 */

import { observable } from '../observable';
import { shadowObservable } from '../shadow-observable';
import { observe } from '../observer';
import { raw } from '../internals/utils';

describe('#6 rawToProxy 按深度模式分桶', () => {
  describe('先 shadow 后 deep', () => {
    test('observable(raw) 返回独立的 deep 代理, 深层响应正常', () => {
      const rawObj = { nested: { a: 1 }, count: 0 };
      const s = shadowObservable(rawObj);
      const o = observable(rawObj);

      // 两种模式必须是两个不同的代理
      expect(o).not.toBe(s);

      let calls = 0;
      observe(() => {
        o.nested.a;
        calls++;
      });
      expect(calls).toBe(1);

      // deep 代理的嵌套属性必须是响应式的
      o.nested.a = 2;
      expect(calls).toBe(2);
      expect(rawObj.nested.a).toBe(2);
    });

    test('shadow 代理保持浅层语义 (嵌套内部属性变更不触发)', () => {
      const rawObj = { user: { name: 'John' }, count: 0 };
      const s = shadowObservable(rawObj);
      observable(rawObj);

      let nestedCalls = 0;
      let rootCalls = 0;
      observe(() => {
        s.user.name;
        nestedCalls++;
      });
      observe(() => {
        s.count;
        rootCalls++;
      });
      expect(nestedCalls).toBe(1);
      expect(rootCalls).toBe(1);

      // 浅层: 嵌套对象内部属性变更不触发
      s.user.name = 'Jane';
      expect(nestedCalls).toBe(1);

      // 根级别属性变更触发
      s.count = 5;
      expect(rootCalls).toBe(2);
    });

    test('shadow 之后创建 deep 时 options 仍然生效', () => {
      const rawObj = { count: 0 };
      shadowObservable(rawObj);
      // transformReactions 返回空数组: 过滤掉所有 reactions
      const o = observable(rawObj, {
        reactionHandlers: {
          transformReactions: () => [],
        },
      });

      let calls = 0;
      observe(() => {
        o.count;
        calls++;
      });
      expect(calls).toBe(1);

      o.count = 1;
      // options 已随 deep 代理创建写入, reactions 被过滤, 不再触发
      expect(calls).toBe(1);
    });
  });

  describe('先 deep 后 shadow', () => {
    test('shadowObservable(raw) 返回独立的 shadow 代理, 浅层语义正常', () => {
      const rawObj = { user: { name: 'John' }, count: 0 };
      const o = observable(rawObj);
      const s = shadowObservable(rawObj);

      expect(s).not.toBe(o);

      let nestedCalls = 0;
      let rootCalls = 0;
      observe(() => {
        s.user.name;
        nestedCalls++;
      });
      observe(() => {
        s.count;
        rootCalls++;
      });
      expect(nestedCalls).toBe(1);
      expect(rootCalls).toBe(1);

      // 浅层语义: 嵌套对象内部属性变更不触发
      s.user.name = 'Jane';
      expect(nestedCalls).toBe(1);

      // 根级别属性变更触发
      s.count = 5;
      expect(rootCalls).toBe(2);
    });

    test('deep 代理的深层响应不受 shadow 创建影响', () => {
      const rawObj = { nested: { a: 1 } };
      const o = observable(rawObj);
      shadowObservable(rawObj);

      let calls = 0;
      observe(() => {
        o.nested.a;
        calls++;
      });
      expect(calls).toBe(1);

      o.nested.a = 2;
      expect(calls).toBe(2);
    });
  });

  describe('同一 raw 的两个代理互不串扰', () => {
    test('每种模式各自缓存: 重复调用返回各自的缓存代理', () => {
      const rawObj = { a: 1 };
      const s1 = shadowObservable(rawObj);
      const o1 = observable(rawObj);
      const s2 = shadowObservable(rawObj);
      const o2 = observable(rawObj);

      expect(s2).toBe(s1);
      expect(o2).toBe(o1);
      expect(s1).not.toBe(o1);
    });

    test('两个代理上的依赖都被触发', () => {
      const rawObj = { count: 0 };
      const s = shadowObservable(rawObj);
      const o = observable(rawObj);

      let shadowCalls = 0;
      let deepCalls = 0;
      observe(() => {
        s.count;
        shadowCalls++;
      });
      observe(() => {
        o.count;
        deepCalls++;
      });
      expect(shadowCalls).toBe(1);
      expect(deepCalls).toBe(1);

      // 同一 raw, 任一代理写入都要触发两侧依赖
      s.count = 1;
      expect(shadowCalls).toBe(2);
      expect(deepCalls).toBe(2);

      o.count = 2;
      expect(shadowCalls).toBe(3);
      expect(deepCalls).toBe(3);
    });

    test('shadow 依赖在 deep 代理创建后仍然存活 (连接表不得被重置)', () => {
      const rawObj = { count: 0 };
      const s = shadowObservable(rawObj);

      let calls = 0;
      observe(() => {
        s.count;
        calls++;
      });
      expect(calls).toBe(1);

      // 之后再为同一 raw 创建 deep 代理, 不得清空已有连接
      const o = observable(rawObj);
      expect(o).not.toBe(s);

      s.count = 1;
      expect(calls).toBe(2);
    });

    test('raw() 对两个代理都返回原对象', () => {
      const rawObj = { a: 1 };
      const s = shadowObservable(rawObj);
      const o = observable(rawObj);

      expect(raw(s)).toBe(rawObj);
      expect(raw(o)).toBe(rawObj);
    });
  });
});
