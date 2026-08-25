import { observable, isObservable } from '../../main';

describe('none observable built-ins', () => {
  test('objects with global constructors should not be converted to observables', () => {
    (window as any).MyClass = class MyClass {};
    const obj = new (window as any).MyClass();
    const obs = observable(obj);
    expect(obs).toBe(obj);
    expect(isObservable(obs)).toBe(false);
  });

  test('objects with local constructors should be converted to observables', () => {
    class MyClass {}
    const obj = new MyClass();
    const obs = observable(obj);
    expect(obs).not.toBe(obj);
    expect(isObservable(obs)).toBe(true);
  });

  test('global objects should be converted to observables', () => {
    (window as any).obj = {};
    const obs = observable((window as any).obj);
    expect(obs).not.toBe((window as any).obj);
    expect(isObservable(obs)).toBe(true);
  });

  test('Date should not be converted to observable', () => {
    const date = new Date();
    const obsDate = observable(date);
    expect(obsDate).toBe(date);
    expect(isObservable(obsDate)).toBe(false);
  });

  test('RegExp should not be converted to observable', () => {
    const regex = new RegExp('');
    const obsRegex = observable(regex);
    expect(obsRegex).toBe(regex);
    expect(isObservable(obsRegex)).toBe(false);
  });

  test('Node should not be converted to observable', () => {
    const node = document;
    const obsNode = observable(node);
    expect(obsNode).toBe(node);
    expect(isObservable(obsNode)).toBe(false);
  });
});
