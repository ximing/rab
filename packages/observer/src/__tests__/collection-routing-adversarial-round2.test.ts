/*
 * GG7 对抗审查第 2 轮 (round 2) 的 RED 复现测试:
 *
 * 1. [high] observable(new Map([[NaN, x]])) 在 normalizeCollectionEntries 内
 *    死循环 —— NaN !== NaN 使 `rawKey !== key` 对原始值恒真, delete+set 迭代
 *    重访该条目, 永不终止 (Set 分支同理)。NaN key 由 Map 以 SameValueZero
 *    合法支持。挂死无法在 jest 进程内直接断言, 用子进程 + timeout。
 * 2. [medium] 自定义 Symbol.toStringTag 的 Map/Set 子类仍落 baseProxyHandler,
 *    m.set() 抛 "incompatible receiver" —— tag 路由缺 instanceof 或集。
 * 4. [medium] class AppError extends Error 被 '[object Error]' tag 黑名单
 *    误拦, observable() 直接返回 raw, 静默失去响应式 (HEAD~1 会正常包装)。
 * 6. [medium] shadowObservable 集合子类自定义方法被 bind(raw), 方法内的
 *    this.set 走原生 Map.prototype.set, 零通知。
 * 3/8. [low] 伪造 '[object Map]' tag 的普通对象被误路由到 collection handlers;
 *    抛异常的 Symbol.toStringTag getter 使 observable() 直接抛错。
 * 7. [low] 子类覆写 clear() 并在 clear 内注册 debugger reaction 时, 该
 *    reaction 落在 hasOperationOldValueConsumer 检查之后的窗口里, 收到的
 *    oldValue 是 undefined 而非 clear 前内容拷贝。
 * */
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { observable, observe, shadowObservable } from "../main";

describe("GG7 round2: NaN collection keys must not hang normalization", () => {
  test(
    "observable(new Map([[NaN, ...]])) completes and keeps the NaN entry",
    () => {
      const script = `
import { observable } from ${JSON.stringify(path.join(__dirname, "..", "main"))};
const sym = Symbol("s");
// 注意: .mjs 子进程脚本必须是纯 JS (tsx 对 .mjs 不做类型剥离)
const m = observable(new Map([[NaN, "nan"], [sym, "sym"]]));
process.stdout.write("RESULT:" + JSON.stringify({
  size: m.size,
  hasNan: m.has(NaN),
  nanValue: m.get(NaN),
  hasSym: m.has(sym),
  symValue: m.get(sym),
}));
`;
      const scriptPath = path.join(os.tmpdir(), "gg7-nan-map-repro.mjs");
      fs.writeFileSync(scriptPath, script);
      // 挂死场景下子进程被 timeout kill (signal SIGTERM / status null)
      const res = spawnSync(
        path.resolve(__dirname, "../../node_modules/.bin/tsx"),
        [scriptPath],
        { timeout: 8000, encoding: "utf8" }
      );
      expect(res.status).toBe(0);
      const line = (res.stdout || "").match(/RESULT:(\{.*\})/);
      expect(line).not.toBeNull();
      const out = JSON.parse(line![1]);
      expect(out.size).toBe(2);
      expect(out.hasNan).toBe(true);
      expect(out.nanValue).toBe("nan");
      expect(out.hasSym).toBe(true);
      expect(out.symValue).toBe("sym");
    },
    15000
  );

  test("observable(new Set([NaN, ...])) completes and keeps the NaN value", () => {
    const script = `
import { observable } from ${JSON.stringify(path.join(__dirname, "..", "main"))};
const s = observable(new Set([NaN, 1]));
process.stdout.write("RESULT:" + JSON.stringify({
  size: s.size,
  hasNan: s.has(NaN),
  hasOne: s.has(1),
}));
`;
    const scriptPath = path.join(os.tmpdir(), "gg7-nan-set-repro.mjs");
    fs.writeFileSync(scriptPath, script);
    const res = spawnSync(
      path.resolve(__dirname, "../../node_modules/.bin/tsx"),
      [scriptPath],
      { timeout: 8000, encoding: "utf8" }
    );
    expect(res.status).toBe(0);
    const line = (res.stdout || "").match(/RESULT:(\{.*\})/);
    expect(line).not.toBeNull();
    const out = JSON.parse(line![1]);
    expect(out.size).toBe(2);
    expect(out.hasNan).toBe(true);
    expect(out.hasOne).toBe(true);
  });
});

describe("GG7 round2: custom Symbol.toStringTag collection subclasses route to collection handlers", () => {
  class TaggedMap extends Map<any, any> {
    get [Symbol.toStringTag]() {
      return "TaggedMap";
    }
  }
  class TaggedSet extends Set<any> {
    get [Symbol.toStringTag]() {
      return "TaggedSet";
    }
  }

  test("deep TaggedMap: set/get/has/delete are reactive", () => {
    const raw = new TaggedMap();
    const m = observable(raw);
    expect(m).not.toBe(raw); // wrapped proxy, not raw passthrough
    let dummy: any;
    observe(() => (dummy = m.get("a")));
    expect(dummy).toBeUndefined();
    m.set("a", 1);
    expect(dummy).toBe(1);
    expect(m.has("a")).toBe(true);
    m.set("a", 2);
    expect(dummy).toBe(2);
    expect(m.delete("a")).toBe(true);
    expect(dummy).toBeUndefined();
    expect(m.size).toBe(0);
  });

  test("shadow TaggedSet: add/has/delete are reactive", () => {
    const s = shadowObservable(new TaggedSet());
    let seen: boolean | undefined;
    observe(() => (seen = s.has("a")));
    expect(seen).toBe(false);
    s.add("a");
    expect(seen).toBe(true);
    s.delete("a");
    expect(seen).toBe(false);
  });
});

describe("GG7 round2: user subclasses of blacklisted built-ins keep base reactivity", () => {
  test("class AppError extends Error is wrapped and reactive on own properties", () => {
    class AppError extends Error {
      code = 1;
    }
    const err = new AppError("boom");
    const oe = observable(err);
    expect(oe).not.toBe(err); // HEAD~1 wrapped Error subclasses with the base handler
    let dummy: number | undefined;
    observe(() => (dummy = (oe as AppError).code));
    expect(dummy).toBe(1);
    (oe as AppError).code = 3;
    expect(dummy).toBe(3);
    expect(err.code).toBe(3); // writes land on the raw target
  });
});

describe("GG7 round2: shadow collection subclass custom methods must notify", () => {
  class MyMap extends Map<any, any> {
    putTwice(k: any, v: any) {
      this.set(k, v);
      this.set(k, v);
    }
  }

  test("shadow: subclass custom method goes through the instrumented traps", () => {
    const sm = shadowObservable(new MyMap());
    let dummy: any;
    observe(() => (dummy = sm.get("a")));
    expect(dummy).toBeUndefined();
    sm.putTwice("a", 1);
    expect(sm.size).toBe(1);
    expect(sm.has("a")).toBe(true);
    expect(dummy).toBe(1); // bind(raw) made this silently undefined before
  });

  test("deep: subclass custom method notifies (pin, already worked)", () => {
    const dm = observable(new MyMap());
    let dummy: any;
    observe(() => (dummy = dm.get("a")));
    dm.putTwice("a", 1);
    expect(dummy).toBe(1);
  });
});

describe("GG7 round2: forged / throwing Symbol.toStringTag does not corrupt routing", () => {
  test("object with forged '[object Map]' tag falls back to the base handler", () => {
    const fake: any = { [Symbol.toStringTag]: "Map", x: 1 };
    const po = observable(fake);
    expect(po).not.toBe(fake);
    let dummy: number | undefined;
    observe(() => (dummy = po.x));
    expect(dummy).toBe(1);
    po.x = 2;
    expect(dummy).toBe(2);
    expect(fake.x).toBe(2);
  });

  test("object with forged '[object Set]' tag falls back to the base handler", () => {
    const fake: any = { [Symbol.toStringTag]: "Set", n: 1 };
    const po = observable(fake);
    let dummy: number | undefined;
    observe(() => (dummy = po.n));
    po.n = 2;
    expect(dummy).toBe(2);
  });

  test("throwing Symbol.toStringTag getter does not make observable() throw", () => {
    const o: any = { n: 1 };
    Object.defineProperty(o, Symbol.toStringTag, {
      get() {
        throw new Error("boom-tag");
      },
    });
    let oo: any;
    expect(() => (oo = observable(o))).not.toThrow();
    expect(oo).not.toBe(o);
    let dummy: number | undefined;
    observe(() => (dummy = oo.n));
    oo.n = 2;
    expect(dummy).toBe(2);
  });
});

describe("GG7 round2: clear oldValue TOCTOU window on subclass clear() overrides", () => {
  test("debugger reaction registered inside an overridden clear() still receives the content copy", () => {
    let m: any;
    let registered = false;
    let received: unknown = "unset";
    class EvilMap extends Map<any, any> {
      override clear(): void {
        if (!registered) {
          registered = true;
          // 注册在 hasOperationOldValueConsumer 检查之后、queue 之前 ——
          // 该窗口内注册的 debugger reaction 也必须拿到 clear 前的内容拷贝
          observe(() => m.get("a"), {
            debugger: (op: any) => {
              if (op.type === "clear") received = op.oldValue;
            },
          });
        }
        super.clear();
      }
    }
    m = observable(new EvilMap([["a", 1]]));
    m.clear();
    expect(m.size).toBe(0);
    expect(received).toBeInstanceOf(Map);
    expect((received as Map<any, any>).size).toBe(1);
    expect((received as Map<any, any>).get("a")).toBe(1);
  });
});
