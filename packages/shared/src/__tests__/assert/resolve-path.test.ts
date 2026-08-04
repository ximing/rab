/**
 * assert/resolve-path.ts 单元测试
 *
 * 覆盖点分路径解析和安全摘要转换
 */

import { resolvePath, toSafeActual } from '../../assert/resolve-path';

// ─── resolvePath ──────────────────────────────────────────────────────────────

describe('resolvePath - 基本属性访问', () => {
  it('顶层直接属性', () => {
    const obj = { isInitialized: true };
    expect(resolvePath(obj, 'isInitialized')).toBe(true);
  });

  it('顶层字符串属性', () => {
    const obj = { name: 'hello' };
    expect(resolvePath(obj, 'name')).toBe('hello');
  });

  it('顶层数值属性', () => {
    const obj = { count: 42 };
    expect(resolvePath(obj, 'count')).toBe(42);
  });

  it('顶层 null 属性', () => {
    const obj = { data: null };
    expect(resolvePath(obj, 'data')).toBeNull();
  });

  it('顶层不存在属性返回 undefined', () => {
    const obj = {};
    expect(resolvePath(obj, 'missing')).toBeUndefined();
  });
});

describe('resolvePath - 嵌套路径', () => {
  it('两层嵌套 a.b', () => {
    const obj = { ladingMonitorData: { total: 8 } };
    expect(resolvePath(obj, 'ladingMonitorData.total')).toBe(8);
  });

  it('三层嵌套 a.b.c', () => {
    const obj = { a: { b: { c: 'deep' } } };
    expect(resolvePath(obj, 'a.b.c')).toBe('deep');
  });

  it('深层嵌套路径', () => {
    const obj = {
      assetsReturnWhPagingMap: {
        trunklineWaitAssignPaging: { offset: 0 },
      },
    };
    expect(resolvePath(obj, 'assetsReturnWhPagingMap.trunklineWaitAssignPaging.offset')).toBe(0);
  });
});

describe('resolvePath - 数组下标', () => {
  it('数组下标 arr.0', () => {
    const obj = { list: ['a', 'b', 'c'] };
    expect(resolvePath(obj, 'list.0')).toBe('a');
  });

  it('数组下标 + 属性 arr.0.field', () => {
    const obj = { list: [{ status: 'loading' }, { status: 'done' }] };
    expect(resolvePath(obj, 'list.0.status')).toBe('loading');
    expect(resolvePath(obj, 'list.1.status')).toBe('done');
  });

  it('越界下标返回 undefined', () => {
    const obj = { list: [{ status: 'done' }] };
    expect(resolvePath(obj, 'list.5.status')).toBeUndefined();
  });
});

describe('resolvePath - 转义点', () => {
  it('转义点 a\\.b 表示 key 中有字面量点', () => {
    const obj = { 'a.b': 'value' };
    expect(resolvePath(obj, 'a\\.b')).toBe('value');
  });

  it('转义点 + 普通点 a\\.b.c', () => {
    const obj = { 'a.b': { c: 'nested' } };
    expect(resolvePath(obj, 'a\\.b.c')).toBe('nested');
  });
});

describe('resolvePath - 空路径 / null 中间节点', () => {
  it('空路径返回 undefined', () => {
    const obj = { a: 1 };
    expect(resolvePath(obj, '')).toBeUndefined();
  });

  it('中间节点为 null 时返回 undefined（不抛错）', () => {
    const obj = { ladingMonitorData: null };
    expect(resolvePath(obj as unknown as object, 'ladingMonitorData.list')).toBeUndefined();
  });

  it('中间节点为 undefined 时返回 undefined（不抛错）', () => {
    const obj = { a: undefined };
    expect(resolvePath(obj as unknown as object, 'a.b')).toBeUndefined();
  });

  it('中间节点为基本类型（string）时返回 undefined（不支持原始类型属性访问）', () => {
    const obj = { name: 'hello' };
    // resolvePath 只处理 object/function 类型，不访问原始类型的属性
    // 如需访问 string.length，应直接用 toBe('name.length', ...) 只在顶层访问（object.length 可以）
    expect(resolvePath(obj, 'name.length')).toBeUndefined();
  });

  it('中间节点为数字时返回 undefined', () => {
    const obj = { count: 42 };
    // 数字没有用户定义的 "sub" 属性，返回 undefined
    expect(resolvePath(obj as unknown as object, 'count.sub')).toBeUndefined();
  });
});

// ─── toSafeActual ─────────────────────────────────────────────────────────────

describe('toSafeActual', () => {
  it('null 返回 null', () => {
    expect(toSafeActual(null)).toBeNull();
  });

  it('undefined 返回 undefined', () => {
    expect(toSafeActual(undefined)).toBeUndefined();
  });

  it('string 原样返回', () => {
    expect(toSafeActual('hello')).toBe('hello');
    expect(toSafeActual('')).toBe('');
  });

  it('number 原样返回', () => {
    expect(toSafeActual(42)).toBe(42);
    expect(toSafeActual(0)).toBe(0);
    expect(toSafeActual(-1)).toBe(-1);
  });

  it('boolean 原样返回', () => {
    expect(toSafeActual(true)).toBe(true);
    expect(toSafeActual(false)).toBe(false);
  });

  it('function 返回 "[Function]"', () => {
    expect(toSafeActual(() => {})).toBe('[Function]');
    expect(toSafeActual(function foo() {})).toBe('[Function]');
  });

  it('Array 返回 "[Array(N)]"', () => {
    expect(toSafeActual([])).toBe('[Array(0)]');
    expect(toSafeActual([1, 2, 3])).toBe('[Array(3)]');
  });

  it('object（非 null）返回 "[Object]"', () => {
    expect(toSafeActual({})).toBe('[Object]');
    expect(toSafeActual({ a: 1 })).toBe('[Object]');
  });
});
