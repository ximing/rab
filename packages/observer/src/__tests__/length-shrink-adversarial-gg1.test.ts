/*
 * 对抗审查加固测试 (GG1, regression 镜头): 把针对 G1 收缩修复的攻击面钉死。
 *
 * 这些用例对应审查中实际跑过的 repro, 全部针对"进入条件是否精确"这一回归面:
 * - 失败的收缩 (sealed 数组, Reflect.set 返回 false, length 实际未变)
 *   绝不能通知被"截断"索引区间的依赖 —— 旧实现用 typeof operation.value === "number"
 *   作进入条件, 在该场景会误入收缩分支并假通知 [value, length+1) 区间;
 *   新实现用 target.length < oldValue (捕获于赋值前) 天然免疫。
 * - null / "0x3" 这类会被 ToUint32 折叠的奇异值, 引擎合法转换后仍须正确通知。
 * - has trap (`i in arr`) 注册的索引依赖同样落在被截断区间, 必须被通知。
 * - Array 子类实例 Array.isArray 为 true, 收缩通知路径必须同样生效。
 * */
import { observable, observe } from '../main';

describe('数组 length 收缩: 收缩判定的精确性 (GG1 加固)', () => {
  test('sealed 数组收缩失败 (length 未变) 不得通知被截断索引区间的依赖', () => {
    const base = [1, 2, 3, 4, 5];
    Object.seal(base);
    const arr = observable(base);
    let runs = 0;
    let last: unknown = 'initial';
    observe(() => {
      runs++;
      last = arr[3];
    });
    expect(runs).toBe(1);
    // sealed 数组的索引不可配置, 引擎拒绝收缩。
    // 直接赋值在严格模式下会抛 TypeError (trap 返回 falsy),
    // 用 Reflect.set 取得 "返回 false、不抛错、不生效" 的形态。
    expect(Reflect.set(arr, 'length', 3)).toBe(false);
    expect(arr.length).toBe(5); // 收缩实际未发生
    expect(runs).toBe(1); // 不得因"尝试收缩"而假通知
    expect(last).toBe(4);
  });

  test("Object.defineProperty(arr, 'length', {value: null}) 折叠为 0, 收缩应通知", () => {
    const arr = observable([1, 2, 3, 4, 5]);
    let runs = 0;
    let last: unknown = 'initial';
    observe(() => {
      runs++;
      last = arr[3];
    });
    Object.defineProperty(arr, 'length', { value: null });
    expect(arr.length).toBe(0);
    expect(runs).toBe(2);
    expect(last).toBeUndefined();
  });

  test("Reflect.set(arr, 'length', '0x3') 十六进制字符串收缩应通知", () => {
    const arr = observable([1, 2, 3, 4, 5]);
    let runs = 0;
    let last: unknown = 'initial';
    observe(() => {
      runs++;
      last = arr[4];
    });
    Reflect.set(arr, 'length', '0x3');
    expect(arr.length).toBe(3);
    expect(runs).toBe(2);
    expect(last).toBeUndefined();
  });

  test('has trap 依赖 (3 in arr) 在收缩删除该索引时应被通知', () => {
    const arr = observable([1, 2, 3, 4, 5]);
    let runs = 0;
    let last: unknown = 'initial';
    observe(() => {
      runs++;
      last = 3 in arr;
    });
    expect(last).toBe(true);
    arr.length = 2;
    expect(runs).toBe(2);
    expect(last).toBe(false);
  });

  test('Array 子类实例收缩同样通知被截断索引依赖', () => {
    class MyArr extends Array<number> {}
    const arr = observable(MyArr.from([1, 2, 3, 4, 5]));
    let runs = 0;
    let last: unknown = 'initial';
    observe(() => {
      runs++;
      last = arr[4];
    });
    arr.length = 3;
    expect(runs).toBe(2);
    expect(last).toBeUndefined();
  });
});
