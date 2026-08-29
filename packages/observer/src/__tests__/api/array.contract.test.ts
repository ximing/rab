/**
 * 本文件是数组经 observable() 包装的公开行为契约。
 * 修改此处断言 = 破坏性变更，需要在 changeset 标注 breaking 并在 PR 里说明迁移路径。
 *
 * 覆盖范围：索引读写依赖、length 读写依赖（含收缩通知与字符串数值折叠）、
 * 增长不误报、枚举依赖（Object.keys / for...in / 展开）、变异方法（push/pop/
 * shift/unshift/splice/fill/sort/reverse）一次调用合并为单次通知（#93）、
 * reaction 内自变异不死循环、稀疏数组、Array 子类。
 *
 * 关于方法通知次数（#93）：数组变异方法内部的原语写入序列仍会穿透 proxy trap，
 * 但方法调用被包进 batch，同一 reaction 在方法结束后只触发一次，且读到最终值。
 * 直接 `arr[i] =` / `arr.length =` 仍是立即同步通知（不经过 batch）。
 */
import { observable, observe, isObservable, resetGlobalConfig } from '../../main';

/** 计数器：reaction 每次执行 runs++ 并记录 last */
function counter<T>(reader: () => T): { runs: () => number; last: () => T | undefined } {
  let runs = 0;
  let last: T | undefined;
  observe(() => {
    runs++;
    last = reader();
  });
  return {
    runs: () => runs,
    last: () => last,
  };
}

afterEach(() => {
  resetGlobalConfig();
});

describe('数组 observable 契约：索引读写依赖', () => {
  test('读取 arr[i] 建立该索引的依赖：写入新值后 reaction 重跑并读到新值', () => {
    const arr = observable<number[]>([1, 2, 3]);
    const c = counter(() => arr[1]);
    expect(c.runs()).toBe(1);
    expect(c.last()).toBe(2);
    arr[1] = 20;
    expect(c.runs()).toBe(2);
    expect(c.last()).toBe(20);
  });

  test('向数据属性索引写入与当前值相同的值不触发依赖（Object.is 精确比较）', () => {
    const arr = observable<number[]>([1, 2, 3]);
    const c = counter(() => arr[1]);
    arr[1] = 2;
    expect(c.runs()).toBe(1);
    expect(c.last()).toBe(2);
  });

  test('越界索引写入隐式增长 length，length/枚举/内容依赖各被通知一次', () => {
    const arr = observable<number[]>([1, 2, 3]);
    const len = counter(() => arr.length);
    const keys = counter(() => Object.keys(arr).length);
    const join = counter(() => arr.join(','));
    arr[5] = 9;
    expect(len.last()).toBe(6);
    expect(keys.last()).toBe(4);
    expect(join.last()).toBe('1,2,3,,,9');
    // 各 reaction 总执行次数 = 首跑 1 次 + 通知 1 次
    expect(len.runs()).toBe(2);
    expect(keys.runs()).toBe(2);
    expect(join.runs()).toBe(2);
  });

  test('push 增长数组不误报既有索引依赖', () => {
    const arr = observable<number[]>([1, 2, 3]);
    const c = counter(() => arr[0]);
    arr.push(4);
    expect(c.runs()).toBe(1);
    expect(c.last()).toBe(1);
  });

  test('delete 索引通知该索引依赖（读到 undefined），且保持原生语义：不影响 length', () => {
    const arr = observable<number[]>([1, 2, 3]);
    const c = counter(() => arr[2]);
    delete arr[2];
    expect(c.runs()).toBe(2);
    expect(c.last()).toBeUndefined();
    expect(arr.length).toBe(3);
  });
});

describe('数组 observable 契约：length 读写依赖', () => {
  test('读取 length 建立依赖：赋新值触发；同值赋值不触发', () => {
    const arr = observable<number[]>([1, 2, 3]);
    const c = counter(() => arr.length);
    arr.length = 3;
    expect(c.runs()).toBe(1);
    expect(c.last()).toBe(3);
    arr.length = 5;
    expect(c.runs()).toBe(2);
    expect(c.last()).toBe(5);
  });

  test('length 增长通知 length 依赖，但不误报既有索引依赖', () => {
    const arr = observable<number[]>([1, 2]);
    const len = counter(() => arr.length);
    const idx0 = counter(() => arr[0]);
    arr.length = 10;
    expect(len.runs()).toBe(2);
    expect(len.last()).toBe(10);
    expect(idx0.runs()).toBe(1);
    expect(idx0.last()).toBe(1);
  });

  test('length 收缩通知被截断的非边界索引依赖（5→3 时读 arr[4] 重跑为 undefined）', () => {
    const arr = observable<number[]>([1, 2, 3, 4, 5]);
    const c = counter(() => arr[4]);
    arr.length = 3;
    expect(c.runs()).toBe(2);
    expect(c.last()).toBeUndefined();
  });

  test('length 收缩到 0 通知所有索引依赖', () => {
    const arr = observable<number[]>([1, 2, 3, 4, 5]);
    const first = counter(() => arr[0]);
    const mid = counter(() => arr[2]);
    arr.length = 0;
    expect(first.runs()).toBe(2);
    expect(first.last()).toBeUndefined();
    expect(mid.runs()).toBe(2);
    expect(mid.last()).toBeUndefined();
  });

  test('同一 reaction 依赖多个被截断索引时只重跑一次（不重复通知）', () => {
    const arr = observable<number[]>([1, 2, 3, 4, 5]);
    const c = counter(() => `${arr[3]}/${arr[4]}`);
    arr.length = 2;
    expect(c.runs()).toBe(2);
    expect(c.last()).toBe('undefined/undefined');
  });

  test('字符串数值的 length 赋值按折叠后的数值比较：收缩正常通知、同值不假通知（G1）', () => {
    const arr = observable<number[]>([1, 2, 3, 4, 5]);
    const c = counter(() => arr[3]);
    Reflect.set(arr, 'length', '2');
    expect(arr.length).toBe(2);
    expect(c.runs()).toBe(2);
    expect(c.last()).toBeUndefined();
    // 折叠后与当前 length 相同的字符串赋值不得产生假通知
    Reflect.set(arr, 'length', '2');
    expect(c.runs()).toBe(2);
  });

  test("Object.defineProperty(arr, 'length', { value }) 收缩同样通知被截断索引", () => {
    const arr = observable<number[]>([1, 2, 3, 4, 5]);
    const c = counter(() => arr[4]);
    Object.defineProperty(arr, 'length', { value: 2 });
    expect(arr.length).toBe(2);
    expect(c.runs()).toBe(2);
    expect(c.last()).toBeUndefined();
  });

  test('非法 length 写入（小数）抛 RangeError：状态不变、不发通知', () => {
    const arr = observable<number[]>([1, 2, 3]);
    const c = counter(() => arr[0]);
    expect(() => Reflect.set(arr, 'length', 1.5)).toThrow(RangeError);
    expect(arr.length).toBe(3);
    expect(c.runs()).toBe(1);
    expect(c.last()).toBe(1);
  });
});

describe('数组 observable 契约：枚举依赖（键集合观察）', () => {
  test('Object.keys(arr) 依赖在 push 时触发', () => {
    const arr = observable<number[]>([1, 2]);
    const c = counter(() => Object.keys(arr).length);
    arr.push(3);
    expect(c.runs()).toBe(2);
    expect(c.last()).toBe(3);
  });

  test('Object.keys(arr) 依赖在 delete 索引时触发', () => {
    const arr = observable<number[]>([1, 2, 3]);
    const c = counter(() => Object.keys(arr).length);
    delete arr[1];
    expect(c.runs()).toBe(2);
    expect(c.last()).toBe(2);
  });

  test('for...in 依赖在 push 时触发', () => {
    const arr = observable<string[]>(['a']);
    const c = counter(() => {
      let n = 0;
      // eslint-disable-next-line no-restricted-syntax
      for (const key in arr) {
        if (typeof key === 'string') n++;
      }
      return n;
    });
    arr.push('b');
    expect(c.runs()).toBe(2);
    expect(c.last()).toBe(2);
  });

  test('数组展开 [...arr] 依赖在 push 时触发', () => {
    const arr = observable<number[]>([1, 2]);
    const c = counter(() => [...arr].join(','));
    arr.push(3);
    expect(c.runs()).toBe(2);
    expect(c.last()).toBe('1,2,3');
  });

  test('Object.keys(arr) 依赖在 length 收缩时触发', () => {
    const arr = observable<number[]>([1, 2, 3]);
    const c = counter(() => Object.keys(arr).length);
    arr.length = 1;
    expect(c.runs()).toBe(2);
    expect(c.last()).toBe(1);
  });

  test('修改既有索引的值不触发枚举依赖（键集合未变化）', () => {
    const arr = observable<number[]>([1, 2, 3]);
    const c = counter(() => Object.keys(arr).length);
    arr[1] = 20;
    expect(c.runs()).toBe(1);
    expect(c.last()).toBe(3);
  });
});

describe('数组 observable 契约：变异方法一次调用合并为单次通知（#93）', () => {
  test('push(单项)：length 与内容依赖各恰通知一次，返回新长度', () => {
    const arr = observable<number[]>([1, 2, 3]);
    const len = counter(() => arr.length);
    const join = counter(() => arr.join(','));
    expect(arr.push(4)).toBe(4);
    expect(len.runs()).toBe(2);
    expect(len.last()).toBe(4);
    expect(join.runs()).toBe(2);
    expect(join.last()).toBe('1,2,3,4');
  });

  test('push(多项)：一次方法调用 length 依赖只通知一次（#93）', () => {
    const arr = observable<number[]>([1, 2, 3]);
    const len = counter(() => arr.length);
    arr.push(4, 5);
    expect(len.runs()).toBe(2);
    expect(len.last()).toBe(5);
  });

  test('pop：一次方法调用只通知一次（#93），返回被弹出元素，最终值正确', () => {
    const arr = observable<number[]>([1, 2, 3]);
    const len = counter(() => arr.length);
    const join = counter(() => arr.join(','));
    expect(arr.pop()).toBe(3);
    expect(len.runs()).toBe(2);
    expect(len.last()).toBe(2);
    expect(join.runs()).toBe(2);
    expect(join.last()).toBe('1,2');
  });

  test('shift：一次方法调用只通知一次（#93），最终值正确，不暴露中间状态', () => {
    const arr = observable<number[]>([1, 2, 3]);
    const len = counter(() => arr.length);
    const join = counter(() => arr.join(','));
    const idx0 = counter(() => arr[0]);
    expect(arr.shift()).toBe(1);
    expect(len.runs()).toBe(2);
    expect(len.last()).toBe(2);
    expect(join.runs()).toBe(2);
    expect(join.last()).toBe('2,3');
    expect(idx0.runs()).toBe(2);
    expect(idx0.last()).toBe(2);
  });

  test('unshift：一次方法调用只通知一次（#93），最终值正确', () => {
    const arr = observable<number[]>([1, 2, 3]);
    const len = counter(() => arr.length);
    const join = counter(() => arr.join(','));
    expect(arr.unshift(0)).toBe(4);
    expect(len.runs()).toBe(2);
    expect(len.last()).toBe(4);
    expect(join.runs()).toBe(2);
    expect(join.last()).toBe('0,1,2,3');
  });

  test('splice 删除：一次方法调用只通知一次（#93），返回被删元素组成的普通（未包装）数组', () => {
    const arr = observable<number[]>([1, 2, 3, 4, 5]);
    const len = counter(() => arr.length);
    const idx1 = counter(() => arr[1]);
    const removed = arr.splice(1, 2);
    expect(removed).toEqual([2, 3]);
    expect(isObservable(removed)).toBe(false);
    expect(len.runs()).toBe(2);
    expect(len.last()).toBe(3);
    expect(idx1.runs()).toBe(2);
    expect(idx1.last()).toBe(4);
  });

  test('splice 插入：一次方法调用 length 依赖只通知一次（#93），最终值正确', () => {
    const arr = observable<number[]>([1, 10, 11, 5]);
    const len = counter(() => arr.length);
    arr.splice(2, 0, 20);
    expect(len.runs()).toBe(2);
    expect(len.last()).toBe(5);
    expect(arr.join(',')).toBe('1,10,20,11,5');
  });

  test('fill(既有范围)：不通知 length/枚举依赖；多索引内容依赖只通知一次；返回数组自身', () => {
    const arr = observable<number[]>([1, 2, 3]);
    const len = counter(() => arr.length);
    const keys = counter(() => Object.keys(arr).length);
    const idx1 = counter(() => arr[1]);
    const join = counter(() => arr.join(','));
    expect(arr.fill(0)).toBe(arr);
    expect(len.runs()).toBe(1);
    expect(keys.runs()).toBe(1);
    expect(idx1.runs()).toBe(2);
    expect(idx1.last()).toBe(0);
    expect(join.runs()).toBe(2);
    expect(join.last()).toBe('0,0,0');
    expect(arr.join(',')).toBe('0,0,0');
  });

  test('fill 的写入范围按原生语义收敛到当前 length，不会增长数组', () => {
    const arr = observable<number[]>([1, 2, 3]);
    arr.fill(0, 0, 5);
    expect(arr.length).toBe(3);
    expect(arr.join(',')).toBe('0,0,0');
  });

  test('sort：不通知 length/枚举依赖，只通知被重排的索引；返回代理自身', () => {
    const arr = observable<number[]>([3, 1, 2]);
    const len = counter(() => arr.length);
    const keys = counter(() => Object.keys(arr).length);
    const idx0 = counter(() => arr[0]);
    const idx1 = counter(() => arr[1]);
    expect(arr.sort((a, b) => a - b)).toBe(arr);
    expect(len.runs()).toBe(1);
    expect(keys.runs()).toBe(1);
    expect(idx0.runs()).toBe(2);
    expect(idx0.last()).toBe(1);
    expect(idx1.runs()).toBe(2);
    expect(idx1.last()).toBe(2);
  });

  test('reverse：不通知 length/枚举依赖，通知被移动的索引；返回代理自身', () => {
    const arr = observable<number[]>([1, 2, 3]);
    const len = counter(() => arr.length);
    const idx0 = counter(() => arr[0]);
    expect(arr.reverse()).toBe(arr);
    expect(len.runs()).toBe(1);
    expect(idx0.runs()).toBe(2);
    expect(idx0.last()).toBe(3);
    expect(arr.join(',')).toBe('3,2,1');
  });

  test('空数组上 pop/shift 不改变状态、不通知', () => {
    const arr = observable<number[]>([]);
    const len = counter(() => arr.length);
    expect(arr.pop()).toBeUndefined();
    expect(arr.shift()).toBeUndefined();
    expect(len.runs()).toBe(1);
    expect(len.last()).toBe(0);
  });

  test('pin: Array.prototype.push.call 不走包装方法，多项 push 仍逐条通知', () => {
    const arr = observable<number[]>([1]);
    const len = counter(() => arr.length);
    Array.prototype.push.call(arr, 2, 3);
    expect(len.runs()).toBe(3);
    expect(len.last()).toBe(3);
  });
});

describe('数组 observable 契约：reaction 内自变异（同步重入抑制）', () => {
  test('reaction 运行中 push 自己依赖的数组不会无限递归：只执行首跑一次', () => {
    const arr = observable<number[]>([1]);
    let runs = 0;
    observe(() => {
      runs++;
      arr.push(arr.length);
    });
    expect(runs).toBe(1);
    expect(arr.length).toBe(2);
  });

  test('reaction 运行中 sort 自己依赖的数组不死循环：一次执行后停止', () => {
    const arr = observable<number[]>([3, 1, 2]);
    let runs = 0;
    observe(() => {
      runs++;
      arr.sort((a, b) => a - b);
    });
    expect(runs).toBe(1);
    expect(arr.join(',')).toBe('1,2,3');
  });
});

describe('数组 observable 契约：稀疏数组', () => {
  test('空洞索引可被依赖：读取为 undefined，填充空洞后通知', () => {
    const arr = observable<Array<number | undefined>>([1, , 3]);
    const c = counter(() => arr[1]);
    expect(c.last()).toBeUndefined();
    arr[1] = 5;
    expect(c.runs()).toBe(2);
    expect(c.last()).toBe(5);
    expect(Object.keys(arr)).toEqual(['0', '1', '2']);
  });

  test('delete 已填充的索引使该索引依赖被通知（读回 undefined）', () => {
    const arr = observable<number[]>([1, 5, 3]);
    const c = counter(() => arr[1]);
    delete arr[1];
    expect(c.runs()).toBe(2);
    expect(c.last()).toBeUndefined();
  });

  test('length 收缩通知空洞索引上的依赖', () => {
    const arr = observable<Array<number | undefined>>([1, , 3]);
    const c = counter(() => arr[1]);
    arr.length = 1;
    expect(c.runs()).toBe(2);
    expect(c.last()).toBeUndefined();
  });
});

describe('数组 observable 契约：Array 子类', () => {
  test('Array 子类实例可被包装：Array.isArray 为 true、instanceof 子类保持，依赖行为与普通数组一致', () => {
    class MyArray<T> extends Array<T> {}
    const arr = observable(new MyArray<number>());
    expect(Array.isArray(arr)).toBe(true);
    expect(arr instanceof MyArray).toBe(true);
    const c = counter(() => arr.length);
    arr.push(1, 2);
    expect(c.runs()).toBe(2);
    expect(c.last()).toBe(2);
    arr[0] = 10;
    const idx = counter(() => arr[0]);
    arr[0] = 20;
    expect(idx.runs()).toBe(2);
    expect(idx.last()).toBe(20);
  });
});
