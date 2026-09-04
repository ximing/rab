/**
 * observer 核心差分属性测试（property-based / differential）
 *
 * 方法：用 fast-check 生成随机操作序列，同一序列同时施加到
 * observable 与一个普通对象/集合参照物上，逐步断言：
 * 1. 状态一致 —— 所有读取路径（key 直读、key 集合、迭代内容）与参照相同；
 * 2. 通知语义一致 —— 同步 reaction 观察到的派生值永远等于参照的当前派生值
 *    （漏通知 → 陈旧值被捕获；多通知不影响值，由对象属性额外精确断言次数）；
 * 3. 对象属性额外断言 reaction 运行次数的精确模型（无效写入不通知、
 *    batch 合并为一次）—— 这是 #93/#212 一族语义的组合空间覆盖。
 *
 * 这组测试把对抗 review 反复挖掘的「操作 × 顺序 × 批量」组合空间变成
 * CI 里的常驻扫描。日常默认 100 组序列；发布门禁用 RAB_PROPERTY_RUNS
 * 放大（见 package.json 的 test:release）。
 */
import fc from 'fast-check';

import { observable, observe, batch } from '../main';

const NUM_RUNS = Number(process.env.RAB_PROPERTY_RUNS ?? 100);

const keyArb = fc.constantFrom('a', 'b', 'c', 'd');
const valArb = fc.oneof(fc.integer({ min: -5, max: 5 }), fc.constantFrom('x', 'y'));

type Mut = { kind: 'set'; key: string; value: number | string } | { kind: 'del'; key: string };

type Step = Mut | { kind: 'batch'; ops: Mut[] };

const mutArb: fc.Arbitrary<Mut> = fc.oneof(
  fc.record({ kind: fc.constant('set' as const), key: keyArb, value: valArb }),
  fc.record({ kind: fc.constant('del' as const), key: keyArb })
);

const stepArb: fc.Arbitrary<Step> = fc.oneof(
  { weight: 3, arbitrary: mutArb },
  {
    weight: 1,
    arbitrary: fc.record({
      kind: fc.constant('batch' as const),
      ops: fc.array(mutArb, { minLength: 1, maxLength: 4 }),
    }),
  }
);

function renderObject(o: Record<string, number | string>): string {
  return Object.keys(o)
    .sort()
    .map(k => `${k}=${String(o[k])}`)
    .join('|');
}

describe('差分属性：普通对象（set/delete/batch × reaction 通知语义）', () => {
  it('任意操作序列后状态与 reaction 派生值与参照一致，运行次数符合精确模型', () => {
    fc.assert(
      fc.property(fc.array(stepArb, { minLength: 5, maxLength: 50 }), steps => {
        const ref: Record<string, number | string> = {};
        const obs = observable<Record<string, number | string>>({});

        let runs = 0;
        let lastSeen = '';
        observe(() => {
          runs++;
          lastSeen = renderObject(obs);
        });
        // observe 首跑
        let expectedRuns = 1;
        expect(lastSeen).toBe(renderObject(ref));

        /** 施加一条变更到参照与 observable，返回是否为「有效变更」（会触发通知） */
        const applyMut = (m: Mut): boolean => {
          if (m.kind === 'set') {
            const had = Object.prototype.hasOwnProperty.call(ref, m.key);
            const changed = !had || !Object.is(ref[m.key], m.value);
            ref[m.key] = m.value;
            obs[m.key] = m.value;
            return changed;
          }
          const had = Object.prototype.hasOwnProperty.call(ref, m.key);
          delete ref[m.key];
          delete obs[m.key];
          return had;
        };

        for (const step of steps) {
          if (step.kind === 'batch') {
            let dirty = false;
            batch(() => {
              for (const op of step.ops) {
                dirty = applyMut(op) || dirty;
              }
            });
            // batch 内有任一有效变更 → 合并为恰好一次通知
            if (dirty) {
              expectedRuns++;
            }
          } else if (applyMut(step)) {
            expectedRuns++;
          }

          // 通知语义：派生值必须是参照的当前值（漏通知立即暴露）
          expect(lastSeen).toBe(renderObject(ref));
          // 精确次数模型：无效写入不通知、batch 不多通知
          expect(runs).toBe(expectedRuns);
          // 状态一致：key 集合与逐键直读
          expect(Object.keys(obs).sort()).toEqual(Object.keys(ref).sort());
          for (const k of Object.keys(ref)) {
            expect(obs[k]).toBe(ref[k]);
          }
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });
});

const mapOpArb = fc.oneof(
  fc.record({
    kind: fc.constant('set' as const),
    key: keyArb,
    value: fc.integer({ min: -9, max: 9 }),
  }),
  fc.record({ kind: fc.constant('del' as const), key: keyArb }),
  fc.record({ kind: fc.constant('clear' as const) })
);

function renderMap(m: Map<string, number>): string {
  return [...m.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('|');
}

describe('差分属性：observable Map', () => {
  it('set/delete/clear 任意序列后，迭代内容与 reaction 派生值与参照一致', () => {
    fc.assert(
      fc.property(fc.array(mapOpArb, { minLength: 5, maxLength: 40 }), ops => {
        const ref = new Map<string, number>();
        const obs = observable(new Map<string, number>());

        let lastSeen = '';
        observe(() => {
          lastSeen = renderMap(obs);
        });

        for (const op of ops) {
          if (op.kind === 'set') {
            ref.set(op.key, op.value);
            obs.set(op.key, op.value);
          } else if (op.kind === 'del') {
            ref.delete(op.key);
            obs.delete(op.key);
          } else {
            ref.clear();
            obs.clear();
          }

          expect(lastSeen).toBe(renderMap(ref));
          expect(obs.size).toBe(ref.size);
          for (const k of ref.keys()) {
            expect(obs.get(k)).toBe(ref.get(k));
          }
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });
});

const setOpArb = fc.oneof(
  fc.record({ kind: fc.constant('add' as const), value: fc.integer({ min: -9, max: 9 }) }),
  fc.record({ kind: fc.constant('del' as const), value: fc.integer({ min: -9, max: 9 }) }),
  fc.record({ kind: fc.constant('clear' as const) })
);

describe('差分属性：observable Set', () => {
  it('add/delete/clear 任意序列后，内容与 reaction 派生值与参照一致', () => {
    fc.assert(
      fc.property(fc.array(setOpArb, { minLength: 5, maxLength: 40 }), ops => {
        const ref = new Set<number>();
        const obs = observable(new Set<number>());

        const render = (s: Set<number>) => [...s].sort((a, b) => a - b).join('|');
        let lastSeen = '';
        observe(() => {
          lastSeen = render(obs);
        });

        for (const op of ops) {
          if (op.kind === 'add') {
            ref.add(op.value);
            obs.add(op.value);
          } else if (op.kind === 'del') {
            ref.delete(op.value);
            obs.delete(op.value);
          } else {
            ref.clear();
            obs.clear();
          }

          expect(lastSeen).toBe(render(ref));
          expect(obs.size).toBe(ref.size);
          for (const v of ref) {
            expect(obs.has(v)).toBe(true);
          }
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });
});

const arrayOpArb = fc.oneof(
  fc.record({ kind: fc.constant('push' as const), value: fc.integer({ min: -9, max: 9 }) }),
  fc.record({ kind: fc.constant('pop' as const) }),
  fc.record({ kind: fc.constant('unshift' as const), value: fc.integer({ min: -9, max: 9 }) }),
  fc.record({ kind: fc.constant('shift' as const) })
);

describe('差分属性：observable 数组（变异方法的 batch 包装）', () => {
  it('push/pop/shift/unshift 任意序列后，内容与 reaction 派生值与参照一致', () => {
    fc.assert(
      fc.property(fc.array(arrayOpArb, { minLength: 5, maxLength: 40 }), ops => {
        const ref: number[] = [];
        const obs = observable<number[]>([]);

        let lastSeen = '';
        observe(() => {
          lastSeen = obs.join(',');
        });

        for (const op of ops) {
          if (op.kind === 'push') {
            ref.push(op.value);
            obs.push(op.value);
          } else if (op.kind === 'pop') {
            ref.pop();
            obs.pop();
          } else if (op.kind === 'unshift') {
            ref.unshift(op.value);
            obs.unshift(op.value);
          } else {
            ref.shift();
            obs.shift();
          }

          expect(lastSeen).toBe(ref.join(','));
          expect(obs.length).toBe(ref.length);
          for (let i = 0; i < ref.length; i++) {
            expect(obs[i]).toBe(ref[i]);
          }
        }
      }),
      { numRuns: NUM_RUNS }
    );
  });
});
