/**
 * utils/identifier.ts 单元测试
 */

import { getIdentifierLabel, getIdentifierType } from '../../utils/identifier';

describe('getIdentifierLabel', () => {
  it('Constructor 类型：返回类名', () => {
    class CartService {}
    expect(getIdentifierLabel(CartService)).toBe('CartService');
  });

  it('匿名 Constructor：返回 "AnonymousService"', () => {
    // 通过 Object.defineProperty 覆盖 name 为空字符串，模拟匿名函数
    function AnonymousFn() {}
    Object.defineProperty(AnonymousFn, 'name', { value: '', configurable: true });
    expect(getIdentifierLabel(AnonymousFn as any)).toBe('AnonymousService');
  });

  it('string 类型：原样返回', () => {
    expect(getIdentifierLabel('cartService')).toBe('cartService');
    expect(getIdentifierLabel('my-custom-id')).toBe('my-custom-id');
  });

  it('symbol 类型（有描述）：返回 Symbol(description)', () => {
    const sym = Symbol('orderService');
    expect(getIdentifierLabel(sym)).toBe('Symbol(orderService)');
  });

  it('symbol 类型（无描述）：返回 Symbol()', () => {
    const sym = Symbol();
    expect(getIdentifierLabel(sym)).toBe('Symbol()');
  });
});

describe('getIdentifierType', () => {
  it('Constructor 类型：返回 "constructor"', () => {
    class CartService {}
    expect(getIdentifierType(CartService)).toBe('constructor');
  });

  it('string 类型：返回 "string"', () => {
    expect(getIdentifierType('cartService')).toBe('string');
  });

  it('symbol 类型：返回 "symbol"', () => {
    const sym = Symbol('orderService');
    expect(getIdentifierType(sym)).toBe('symbol');
  });
});
