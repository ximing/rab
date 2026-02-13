import { observable, observe, raw } from '../../main';

describe('WeakSet', () => {
  test('should be a proper JS WeakSet', () => {
    const set = observable(new WeakSet());
    expect(set).toBeInstanceOf(WeakSet);
    expect(raw(set)).toBeInstanceOf(WeakSet);
  });

  test('should observe mutations', () => {
    let dummy: boolean;
    const value = {};
    const set = observable(new WeakSet<object>());
    observe(() => (dummy = set.has(value)));

    expect(dummy!).toBe(false);
    set.add(value);
    expect(dummy!).toBe(true);
    set.delete(value);
    expect(dummy!).toBe(false);
  });

  test('should not observe custom property mutations', () => {
    let dummy: string | undefined;
    const set: any = observable(new WeakSet());
    observe(() => (dummy = set.customProp));

    expect(dummy).toBe(undefined);
    set.customProp = 'Hello World';
    expect(dummy).toBe(undefined);
  });

  test('should not observe non value changing mutations', () => {
    let dummy: boolean;
    const value = {};
    const set = observable(new WeakSet<object>());
    const setSpy = jest.fn(() => (dummy = set.has(value)));
    observe(setSpy);

    expect(dummy!).toBe(false);
    expect(setSpy).toHaveBeenCalledTimes(1);
    set.add(value);
    expect(dummy!).toBe(true);
    expect(setSpy).toHaveBeenCalledTimes(2);
    set.add(value);
    expect(dummy!).toBe(true);
    expect(setSpy).toHaveBeenCalledTimes(2);
    set.delete(value);
    expect(dummy!).toBe(false);
    expect(setSpy).toHaveBeenCalledTimes(3);
    set.delete(value);
    expect(dummy!).toBe(false);
    expect(setSpy).toHaveBeenCalledTimes(3);
  });

  test('should not observe raw data', () => {
    const value = {};
    let dummy: boolean;
    const set = observable(new WeakSet<object>());
    observe(() => (dummy = raw(set).has(value)));

    expect(dummy!).toBe(false);
    set.add(value);
    expect(dummy!).toBe(false);
  });

  test('should not be triggered by raw mutations', () => {
    const value = {};
    let dummy: boolean;
    const set = observable(new WeakSet<object>());
    observe(() => (dummy = set.has(value)));

    expect(dummy!).toBe(false);
    raw(set).add(value);
    expect(dummy!).toBe(false);
  });
});
