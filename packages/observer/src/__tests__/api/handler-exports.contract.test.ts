/**
 * 本文件是 proxyHandlers (baseProxyHandler) 与 shadowProxyHandler 公开导出的行为契约。
 * 修改此处断言 = 破坏性变更，需要在 changeset 标注 breaking 并在 PR 里说明迁移路径。
 *
 * 覆盖面向高级用户（自定义 handler）的承诺：
 * 1. 两个 handler 作为对象导出的形状（各恰好 7 个 trap 键）；
 * 2. `new Proxy(raw, proxyHandlers)` 手工构造响应式代理的高级用法（含当前限制）；
 * 3. `observable(raw, { proxyHandlers })` 的合并语义：Object.assign 部分覆盖、
 *    不污染导出的模块级单例；自定义 set trap 转发到 Reflect 的行为。
 *
 * 具体某个自定义 trap 的业务效果（first-wins、per-raw 键控等 options 语义）
 * 由 observable.contract.test.ts 钉，此处不重复。
 */
import {
  proxyHandlers,
  shadowProxyHandler,
  observable,
  shadowObservable,
  observe,
  unobserve,
  isObservable,
  resetGlobalConfig,
} from "../../main";
import type { ProxyHandlers } from "../../internals/types";

// 类型层面 ObservableOptions.proxyHandlers 要求完整的 7 个 trap，但运行时
// 合并语义是 Object.assign（部分覆盖即可）——本契约钉的是运行时承诺，
// 因此部分 trap 对象在此处收窄断言为完整类型。
type PartialTrapOverride = Partial<ProxyHandlers>;

// 与所有 api/ 契约文件统一的纪律：每个用例独立自包含，
// afterEach 清理全局配置，防止 configure 契约的跨文件污染。
afterEach(() => {
  resetGlobalConfig();
});

describe("handler-exports 契约：proxyHandlers / shadowProxyHandler", () => {
  describe("导出形状", () => {
    test("proxyHandlers 恰好暴露 7 个 trap 键，且每个都是函数", () => {
      // ownKeys 快照（排序后比较，不钉键的枚举顺序）：
      // 新增/删除/重命名任何一个 trap 键都是本 API 的破坏性变更。
      expect(Object.keys(proxyHandlers).sort()).toEqual([
        "construct",
        "defineProperty",
        "deleteProperty",
        "get",
        "has",
        "ownKeys",
        "set",
      ]);
      for (const trap of Object.keys(proxyHandlers)) {
        expect(typeof (proxyHandlers as Record<string, unknown>)[trap]).toBe(
          "function"
        );
      }
    });

    test("shadowProxyHandler 恰好暴露同样的 7 个 trap 键，且每个都是函数", () => {
      expect(Object.keys(shadowProxyHandler).sort()).toEqual([
        "construct",
        "defineProperty",
        "deleteProperty",
        "get",
        "has",
        "ownKeys",
        "set",
      ]);
      for (const trap of Object.keys(shadowProxyHandler)) {
        expect(
          typeof (shadowProxyHandler as Record<string, unknown>)[trap]
        ).toBe("function");
      }
    });

    test("proxyHandlers 与 shadowProxyHandler 是两个独立导出，各自持有独立的 trap 实现", () => {
      // deep 与 shadow 是两个不同的模块级单例：浅层语义靠 shadow 自己的 get 实现，
      // 若二者共享任一 trap 实现（或互为同一对象），shadow 的浅层承诺即被破坏。
      expect(proxyHandlers).not.toBe(shadowProxyHandler);
      expect(proxyHandlers.get).not.toBe(shadowProxyHandler.get);
      expect(proxyHandlers.set).not.toBe(shadowProxyHandler.set);
    });
  });

  describe("new Proxy(raw, proxyHandlers) 手工构造（高级用法）", () => {
    test("对已由 observable() 包装过的 raw，手工代理读写均具备完整响应式，且与正式代理共享连接表（双向互通知）", () => {
      const rawObj = { count: 0 };
      const canonical = observable(rawObj); // 创建连接表并缓存正式代理
      const manual = new Proxy(
        rawObj,
        proxyHandlers as unknown as ProxyHandler<typeof rawObj>
      );

      // 经手工代理读取建立的依赖，经手工代理写入会被通知
      const manualRuns: number[] = [];
      const manualReaction = observe(() => {
        manualRuns.push(manual.count);
      });
      expect(manualRuns).toEqual([0]);

      // 经正式代理读取建立的依赖，经手工代理写入也会被通知（连接按 raw 键控）
      const canonicalRuns: number[] = [];
      const canonicalReaction = observe(() => {
        canonicalRuns.push(canonical.count);
      });
      expect(canonicalRuns).toEqual([0]);

      manual.count = 5; // 写入手工代理
      expect(manualRuns).toEqual([0, 5]);
      expect(canonicalRuns).toEqual([0, 5]);

      canonical.count = 7; // 写入正式代理
      expect(manualRuns).toEqual([0, 5, 7]);
      expect(canonicalRuns).toEqual([0, 5, 7]);

      unobserve(manualReaction);
      unobserve(canonicalReaction);
    });

    test("手工 base 代理保留深层响应式：经它访问的嵌套对象是 observable", () => {
      const rawObj = { nested: { value: 1 } };
      observable(rawObj); // 连接表由正式包装创建
      const manual = new Proxy(
        rawObj,
        proxyHandlers as unknown as ProxyHandler<typeof rawObj>
      );

      // get trap 未被手工构造削弱：嵌套对象仍自动包装为 observable
      expect(isObservable(manual.nested)).toBe(true);

      const runs: number[] = [];
      const reaction = observe(() => {
        runs.push(manual.nested.value);
      });
      expect(runs).toEqual([1]);
      manual.nested.value = 2;
      expect(runs).toEqual([1, 2]);

      unobserve(reaction);
    });

    test("手工 shadow 代理保留浅层语义：嵌套对象不包装，根级写入仍通知", () => {
      const rawObj = { nested: { value: 1 }, count: 0 };
      shadowObservable(rawObj); // 连接表由正式包装创建
      const manual = new Proxy(
        rawObj,
        shadowProxyHandler as unknown as ProxyHandler<typeof rawObj>
      );

      // shadow get trap 的核心承诺：嵌套对象原样返回、不深层包装
      expect(isObservable(manual.nested)).toBe(false);

      const runs: number[] = [];
      const reaction = observe(() => {
        runs.push(manual.count);
      });
      expect(runs).toEqual([0]);
      manual.count = 5;
      expect(runs).toEqual([0, 5]);

      unobserve(reaction);
    });

    test("已知限制：对从未经 observable()/shadowObservable() 包装的 raw，手工代理不参与响应式（读不注册依赖、写不通知）", () => {
      // 当前行为：依赖连接表 (raw -> key -> reactions) 只在正式包装
      // (observable/shadowObservable) 时初始化；手工构造 new Proxy 不会创建它。
      // 因此对"从未被正式包装过"的 raw，手工代理只是一个带 trap 副作用的普通 Proxy。
      // 若未来版本让手工代理自初始化连接表，本用例失败是预期的、是行为改善。
      const rawObj = { count: 0 };
      const manual = new Proxy(
        rawObj,
        proxyHandlers as unknown as ProxyHandler<typeof rawObj>
      );

      const runs: number[] = [];
      const reaction = observe(() => {
        runs.push(manual.count);
      });
      expect(runs).toEqual([0]);

      manual.count = 5;
      // 写入已落盘（读回新值），但没有任何 reaction 被通知
      expect(manual.count).toBe(5);
      expect(runs).toEqual([0]);

      unobserve(reaction);
    });
  });

  describe("options.proxyHandlers 的合并语义（Object.assign）", () => {
    test("只覆盖单个 trap 时，其余 trap 仍是默认实现且照常生效", () => {
      const hasCalls: PropertyKey[] = [];
      const rawObj = { count: 0, nested: { value: 1 } };
      const obs = observable(rawObj, {
        proxyHandlers: {
          has: (target: object, key: PropertyKey) => {
            hasCalls.push(key);
            return proxyHandlers.has(target, key);
          },
        } as PartialTrapOverride as ProxyHandlers,
      });

      // 被覆盖的 trap：自定义逻辑执行且语义不变
      expect("count" in obs).toBe(true);
      expect("missing" in obs).toBe(false);
      expect(hasCalls).toEqual(["count", "missing"]);

      // 未覆盖的 get trap：深层包装照常
      expect(isObservable(obs.nested)).toBe(true);
      const nestedRuns: number[] = [];
      const nestedReaction = observe(() => {
        nestedRuns.push(obs.nested.value);
      });
      expect(nestedRuns).toEqual([1]);
      obs.nested.value = 2;
      expect(nestedRuns).toEqual([1, 2]);

      // 未覆盖的 set trap：同值不通知、变值通知
      const countRuns: number[] = [];
      const countReaction = observe(() => {
        countRuns.push(obs.count);
      });
      expect(countRuns).toEqual([0]);
      obs.count = 0;
      expect(countRuns).toEqual([0]);
      obs.count = 5;
      expect(countRuns).toEqual([0, 5]);

      // 未覆盖的 ownKeys trap：键集合变化通知迭代依赖
      const keyRuns: number[] = [];
      const keyReaction = observe(() => {
        keyRuns.push(Object.keys(obs).length);
      });
      expect(keyRuns).toEqual([2]);
      (obs as Record<string, unknown>).extra = "x";
      expect(keyRuns).toEqual([2, 3]);

      unobserve(nestedReaction);
      unobserve(countReaction);
      unobserve(keyReaction);
    });

    test("通过 options 覆盖 trap 不会污染导出的模块级单例，后续包装不受影响", () => {
      // 这是业务可依赖的隔离承诺：options.proxyHandlers 是合并到一个
      // 副本上，绝不能改写 main.ts 导出的 proxyHandlers 本身——否则一次
      // 自定义就会永久改变全局所有后续 observable() 的行为。
      const defaultGet = proxyHandlers.get;
      const customGet = (
        target: object,
        key: PropertyKey,
        receiver: unknown
      ) => {
        const result = defaultGet(target, key, receiver);
        return key === "marker" ? `custom:${String(result)}` : result;
      };

      const customized = observable(
        { marker: "a", count: 0 },
        {
          proxyHandlers: {
            get: customGet,
          } as PartialTrapOverride as ProxyHandlers,
        }
      );
      expect(customized.marker).toBe("custom:a");

      // 单例未被改动
      expect(proxyHandlers.get).toBe(defaultGet);

      // 后续未传 options 的包装完全不受前一次覆盖影响
      const plain = observable({ marker: "b", count: 0 });
      expect(plain.marker).toBe("b");
      const runs: number[] = [];
      const reaction = observe(() => {
        runs.push(plain.count);
      });
      expect(runs).toEqual([0]);
      plain.count = 1;
      expect(runs).toEqual([0, 1]);

      unobserve(reaction);
    });
  });

  describe("自定义 set trap 转发到 Reflect 的行为", () => {
    test("自定义 set 只转发 Reflect.set(target, key, value, receiver)：写入落盘且依赖该属性的 reaction 仍被通知", () => {
      // Object.assign 是整 trap 替换——自定义 set 不会链接默认 set 的通知逻辑。
      // 但转发 Reflect.set(..., receiver) 会被引擎路由回未被覆盖的默认
      // defineProperty trap，由它兜底发出通知。这是高级用户当前可依赖的行为。
      const setCalls: Array<[PropertyKey, unknown]> = [];
      const rawObj = { count: 0 };
      const obs = observable(rawObj, {
        proxyHandlers: {
          set: (
            target: object,
            key: PropertyKey,
            value: unknown,
            receiver: unknown
          ) => {
            setCalls.push([key, value]);
            return Reflect.set(target, key, value, receiver);
          },
        } as PartialTrapOverride as ProxyHandlers,
      });

      const runs: number[] = [];
      const reaction = observe(() => {
        runs.push(obs.count);
      });
      expect(runs).toEqual([0]);

      obs.count = 5;
      expect(setCalls).toEqual([["count", 5]]); // 自定义逻辑确实接管了 set
      expect(obs.count).toBe(5); // 写入落盘
      expect(runs).toEqual([0, 5]); // reaction 仍被通知

      unobserve(reaction);
    });

    test("自定义 set 委托导出的 proxyHandlers.set：保留默认通知语义（推荐的高级包装模式）", () => {
      // 高级用户要"在写入前后加逻辑"而不是"替换写入语义"时，
      // 委托导出的默认 set 是官方支持的组合方式。
      const setCalls: Array<[PropertyKey, unknown]> = [];
      const rawObj = { count: 0 };
      const obs = observable(rawObj, {
        proxyHandlers: {
          set: (
            target: object,
            key: PropertyKey,
            value: unknown,
            receiver: unknown
          ) => {
            setCalls.push([key, value]);
            return proxyHandlers.set(target, key, value, receiver);
          },
        } as PartialTrapOverride as ProxyHandlers,
      });

      const runs: number[] = [];
      const reaction = observe(() => {
        runs.push(obs.count);
      });
      expect(runs).toEqual([0]);

      obs.count = 5;
      expect(setCalls).toEqual([["count", 5]]);
      expect(runs).toEqual([0, 5]);

      // 委托默认 set 同时保留了它的同值比较承诺：写入相同值不通知
      obs.count = 5;
      expect(setCalls).toEqual([
        ["count", 5],
        ["count", 5],
      ]);
      expect(runs).toEqual([0, 5]);

      unobserve(reaction);
    });
  });
});
