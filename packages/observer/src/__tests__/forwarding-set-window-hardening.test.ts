/*
 * 加固测试 (GG2 对抗审查第 2 轮): 转发窗口 {target,key} 帧匹配的边界行为。
 * 全部为当前正确行为的 pin (审查时用独立 repro 验证过):
 * - 类继承链 setter 内 super.x = v 仍单次通知且值翻倍落盘;
 * - setter 内对同一 observable 的**另一 key** 普通赋值 (set trap 路径) 单次通知;
 * - proto setter 用 Object.defineProperty 把"正在设置的同一个 key"定义到
 *   child (receiver) 上: 通知恰好一次 (set trap 的 add 路径), 不双不漏;
 * - 数组作为 receiver 走原型链 setter, setter 内对另一个 observable
 *   defineProperty 不受数组 set 帧 (index/length) 干扰;
 * - 转发窗口内嵌套写入 (setter 内再写同一 observable 的被观察 key) 单次通知。
 */
import { observable, observe, shadowObservable } from '../main';

function defineValue(obj: object, key: string, value: number) {
  Object.defineProperty(obj, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
}

describe('转发窗口 {target,key} 帧匹配边界 (base handler)', () => {
  test('类继承链 setter 内 super.x = v: 单次通知, 值经 super 翻倍落盘', () => {
    class Base {
      _v = 0;
      get v() {
        return this._v;
      }
      set v(n: number) {
        this._v = n;
      }
    }
    class Child extends Base {
      set v(n: number) {
        super.v = n * 2;
      }
    }
    const inst = observable(new Child()) as unknown as {
      v: number;
      _v: number;
    };
    let calls = 0;
    let seen = 0;
    observe(() => {
      seen = inst._v;
      calls++;
    });
    expect(calls).toBe(1);

    inst.v = 5;
    expect(inst._v).toBe(10); // super.x = v 写到 receiver (proxy), 值为翻倍
    expect(calls).toBe(2); // 单次通知
  });

  test('setter 内对同一 observable 另一 key 普通赋值 (set trap 路径): 单次通知', () => {
    const obj = observable({ n: 0 });
    const proto = observable({
      set go(v: number) {
        obj.n = v;
      },
    });
    const child = observable(Object.create(proto) as { go: number });
    let calls = 0;
    observe(() => {
      void obj.n;
      calls++;
    });
    expect(calls).toBe(1);

    child.go = 9;
    expect(obj.n).toBe(9);
    expect(calls).toBe(2);
  });

  test('proto setter 把正在设置的同一个 key defineProperty 到 child: 恰好一次通知', () => {
    const child = observable(Object.create(null) as { x: number });
    const proto = {
      set x(v: number) {
        defineValue(child, 'x', v);
      },
    };
    Object.setPrototypeOf(child, proto);
    let calls = 0;
    let seen = 0;
    observe(() => {
      seen = child.x;
      calls++;
    });
    expect(calls).toBe(1);

    child.x = 3;
    expect(child.x).toBe(3);
    expect(calls).toBe(2);

    child.x = 4;
    expect(child.x).toBe(4);
    expect(calls).toBe(3);
  });

  test('数组作为 receiver 走原型链 setter, setter 内对另一 observable defineProperty: 必须通知', () => {
    const arr = observable([1, 2, 3]);
    const other = observable({ x: 0 });
    const proto = {
      set go(v: number) {
        defineValue(other, 'x', v);
      },
    };
    Object.setPrototypeOf(arr, proto);
    let calls = 0;
    observe(() => {
      void other.x;
      calls++;
    });
    expect(calls).toBe(1);

    (arr as unknown as { go: number }).go = 1;
    expect(other.x).toBe(1);
    expect(calls).toBe(2);
  });

  test('setter 内嵌套写入被观察 key: 单次通知', () => {
    let depth = 0;
    const obj = observable({ n: 0 });
    const proto = {
      set recurse(v: number) {
        if (depth < 2) {
          depth++;
          obj.n = v;
        }
      },
    };
    Object.setPrototypeOf(obj, proto);
    let calls = 0;
    observe(() => {
      void obj.n;
      calls++;
    });
    expect(calls).toBe(1);

    (obj as unknown as { recurse: number }).recurse = 9;
    expect(obj.n).toBe(9);
    expect(calls).toBe(2);
  });
});

describe('转发窗口 {target,key} 帧匹配边界 (shadow handler)', () => {
  test('类继承链 setter 内 super.w = v: 单次通知, 值经 super 加一落盘', () => {
    class P {
      _w = 0;
      get w() {
        return this._w;
      }
      set w(n: number) {
        this._w = n;
      }
    }
    class C extends P {
      set w(n: number) {
        super.w = n + 1;
      }
    }
    const inst = shadowObservable(new C()) as unknown as {
      w: number;
      _w: number;
    };
    let calls = 0;
    observe(() => {
      void inst._w;
      calls++;
    });
    inst.w = 1;
    expect(inst._w).toBe(2);
    expect(calls).toBe(2);
  });

  test('proto setter 把正在设置的同一个 key defineProperty 到 shadow child: 恰好一次通知', () => {
    const child = shadowObservable(Object.create(null) as { x: number });
    const proto = {
      set x(v: number) {
        defineValue(child, 'x', v);
      },
    };
    Object.setPrototypeOf(child, proto);
    let calls = 0;
    observe(() => {
      void child.x;
      calls++;
    });
    expect(calls).toBe(1);

    child.x = 3;
    expect(child.x).toBe(3);
    expect(calls).toBe(2);
  });
});
