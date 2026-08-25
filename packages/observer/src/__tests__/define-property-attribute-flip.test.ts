/*
 * 回归测试 (G3 第 3 轮对抗审查 #2): defineProperty 的 attribute-only 重定义
 *
 * G3 #3 已确立「描述符改变读取/枚举语义时不得静默」并为数据↔accessor 种类
 * 翻转补了通知, 但只有 {enumerable: ...} 的重定义 (枚举语义翻转, 影响
 * ownKeys / Object.keys / for-in 的 ITERATION_KEY 依赖) 完全静默, 观察者
 * 永久停留在旧的键集合上。
 *
 * 语义约定 (本文件 pin 住, 防 G4+ 误改):
 *   - enumerable 翻转 → 必须通知迭代依赖 (Object.keys 观察者重跑);
 *   - enumerable 翻转不影响属性值读取 → 值观察者 (obj.x) 不通知;
 *   - writable / configurable 翻转 → 按现行语义不通知 (值与键集合都没变,
 *     writable:false 之后的写入失败由 set trap 的 !result 守卫处理)。
 */
import { observable, observe, shadowObservable } from '../main';

describe('enumerable 翻转必须通知迭代依赖', () => {
  test('base: true → false 后 Object.keys 观察者重跑并看到新键集', () => {
    const obj = observable({ x: 1 }) as { x: number };
    const seen: number[] = [];
    observe(() => {
      seen.push(Object.keys(obj).length);
    });
    expect(seen).toEqual([1]);

    Object.defineProperty(obj, 'x', { enumerable: false, configurable: true });
    expect(Object.keys(obj)).toEqual([]);
    expect(seen).toEqual([1, 0]);
  });

  test('base: false → true 同样通知', () => {
    const raw: Record<string, unknown> = {};
    Object.defineProperty(raw, 'x', {
      value: 1,
      writable: true,
      configurable: true,
      enumerable: false,
    });
    const obj = observable(raw) as { x: number };
    const seen: number[] = [];
    observe(() => {
      seen.push(Object.keys(obj).length);
    });
    expect(seen).toEqual([0]);

    Object.defineProperty(obj, 'x', { enumerable: true });
    expect(Object.keys(obj)).toEqual(['x']);
    expect(seen).toEqual([0, 1]);
  });

  test('shadow: true → false 后 Object.keys 观察者重跑', () => {
    const obj = shadowObservable({ x: 1 }) as { x: number };
    const seen: number[] = [];
    observe(() => {
      seen.push(Object.keys(obj).length);
    });
    expect(seen).toEqual([1]);

    Object.defineProperty(obj, 'x', { enumerable: false, configurable: true });
    expect(Object.keys(obj)).toEqual([]);
    expect(seen).toEqual([1, 0]);
  });

  test('base: for...in 观察者同样收到通知', () => {
    const obj = observable({ x: 1, y: 2 }) as Record<string, number>;
    const seen: string[][] = [];
    observe(() => {
      const keys: string[] = [];
      for (const k in obj) {
        keys.push(k);
      }
      seen.push(keys);
    });
    expect(seen).toEqual([['x', 'y']]);

    Object.defineProperty(obj, 'x', { enumerable: false, configurable: true });
    expect(seen).toEqual([['x', 'y'], ['y']]);
  });

  test('base: enumerable 翻转不通知值观察者 (obj.x 读取语义未变)', () => {
    const obj = observable({ x: 1 }) as { x: number };
    const seen: number[] = [];
    observe(() => {
      seen.push(obj.x);
    });
    expect(seen).toEqual([1]);

    Object.defineProperty(obj, 'x', { enumerable: false, configurable: true });
    expect(seen).toEqual([1]); // 值没变, 不通知
    expect(obj.x).toBe(1);
  });

  test('base: {value 不变, enumerable 翻转} 的混合描述符仍通知迭代依赖', () => {
    const obj = observable({ x: 1 }) as { x: number };
    const keysSeen: number[] = [];
    observe(() => {
      keysSeen.push(Object.keys(obj).length);
    });
    expect(keysSeen).toEqual([1]);

    Object.defineProperty(obj, 'x', {
      value: 1,
      enumerable: false,
      configurable: true,
      writable: true,
    });
    expect(keysSeen).toEqual([1, 0]);
  });
});

describe('attribute 翻转不通知的现行语义 (pin, 防止后续批次误改)', () => {
  test('base: writable 翻转不通知值观察者', () => {
    const obj = observable({ x: 1 }) as { x: number };
    const seen: number[] = [];
    observe(() => {
      seen.push(obj.x);
    });
    expect(seen).toEqual([1]);

    Object.defineProperty(obj, 'x', { writable: false, configurable: true });
    expect(seen).toEqual([1]);

    // writable:false 之后的写入失败不通知 (set trap !result 守卫, NEW-B);
    // 本测试文件是 strict mode, 失败的赋值按原生语义抛 TypeError
    expect(() => {
      obj.x = 99;
    }).toThrow(TypeError);
    expect(seen).toEqual([1]);
    expect(obj.x).toBe(1);
  });

  test('base: configurable 翻转不通知', () => {
    const obj = observable({ x: 1 }) as { x: number };
    const seen: number[] = [];
    observe(() => {
      seen.push(obj.x);
    });
    expect(seen).toEqual([1]);

    Object.defineProperty(obj, 'x', { configurable: false });
    expect(seen).toEqual([1]);
  });
});
