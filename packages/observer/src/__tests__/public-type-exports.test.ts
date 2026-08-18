/**
 * 公开类型导出契约 (第 1 轮审查 issue #3):
 * observable(obj, options) 的 options 参数类型 ObservableOptions 必须能从
 * 包入口 main.ts 按名导入 —— 消费方需要它做变量/签名注解, 而非只能靠
 * 结构化类型推断传对象字面量。
 *
 * 运行时断言很弱 (类型擦除), 真正的守卫是 `npx tsc --noEmit` 对本文件的
 * 类型检查: 若 main.ts 未导出该类型, 此处直接编译失败。
 */
import { observable, observe, unobserve } from "../main";
import type { ObservableOptions } from "../main";

describe("公开类型导出: ObservableOptions", () => {
  test("可从 main.ts 按名导入并用作注解", () => {
    const opts: ObservableOptions = {
      reactionHandlers: { transformReactions: (_t, _k, reactions) => reactions },
    };
    const rawObj = { count: 0 };
    const o = observable(rawObj, opts);
    let calls = 0;
    const r = observe(() => {
      o.count;
      calls++;
    });
    o.count = 1;
    expect(calls).toBe(2); // passthrough transform 不滤除, 正常触发
    unobserve(r);
  });
});
