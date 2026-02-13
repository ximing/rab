import { observe, isObservable, raw } from '../main';
import { observable } from '../internals/observable';
import { ProxyHandlers, CollectionHandlers, ReactionHandlers } from '../internals/types';
import { baseProxyHandler } from '../internals/handlers/baseProxyHandler';
import { collectionHandlers } from '../internals/handlers/collectionHandler';

describe('observable', () => {
  test('should return a new observable when no argument is provided', () => {
    const obs = observable();
    expect(isObservable(obs)).toBe(true);
  });

  test('should return an observable wrapping of an object argument', () => {
    const obj = { prop: 'value' };
    const obs = observable(obj);
    expect(obs).not.toBe(obj);
    expect(isObservable(obs)).toBe(true);
  });

  test('should return an observable wrapping of a function argument', () => {
    const fn = () => 10;
    const obs = observable(fn);
    expect(obs).not.toBe(fn);
    expect(isObservable(obs)).toBe(true);
  });

  test('should return an observable instance when an observable class is instantiated', () => {
    class NestedClass {}
    class MyClass {
      static Nested = NestedClass;
    }
    // add an empty custom handlers object to enable
    // deep observable wrapping without reactions
    const ObsClass = observable(MyClass, {});
    expect(isObservable(MyClass)).toBe(false);
    expect(isObservable(ObsClass)).toBe(true);
    expect(isObservable(new MyClass())).toBe(false);
    expect(isObservable(new ObsClass())).toBe(true);
    expect(isObservable(MyClass.Nested)).toBe(false);
    expect(isObservable(ObsClass.Nested)).toBe(true);
    expect(isObservable(new MyClass.Nested())).toBe(false);
    expect(isObservable(new ObsClass.Nested())).toBe(true);
  });

  test('should return the argument if it is already an observable', () => {
    const obs1 = observable();
    const obs2 = observable(obs1);
    expect(obs1).toBe(obs2);
  });

  test('should return the same observable wrapper when called repeatedly with the same argument', () => {
    const obj = { prop: 'value' };
    const obs1 = observable(obj);
    const obs2 = observable(obj);
    expect(obs1).toBe(obs2);
  });

  test('should wrap nested data with observable at get time', () => {
    const obs = observable({ nested: { prop: 1 } });
    expect(isObservable(obs.nested)).toBe(true);
  });

  test('should not throw on none writable nested objects, should simply not observe them instead', () => {
    let dummy: number | undefined;
    const obj: Record<string, any> = {};
    Object.defineProperty(obj, 'prop', {
      value: { num: 12 },
      writable: false,
      configurable: false,
    });
    const obs = observable(obj);
    expect(() => observe(() => (dummy = obs.prop.num))).not.toThrow();
    expect(dummy).toBe(12);
    obj.prop.num = 13;
    expect(dummy).toBe(12);
  });

  test('should never let observables leak into the underlying raw object', () => {
    const obj: Record<string, any> = {};
    const obs = observable(obj);
    obs.nested1 = {};
    obs.nested2 = observable();
    expect(isObservable(obj.nested1)).toBe(false);
    expect(isObservable(obj.nested2)).toBe(false);
    expect(isObservable(obs.nested1)).toBe(true);
    expect(isObservable(obs.nested2)).toBe(true);
  });

  describe('custom handlers', () => {
    test('should run the provided custom Proxy handlers - even when they are not in an observed branch', () => {
      const mockProxyHandlers: ProxyHandlers = {
        get: jest.fn((target, key, receiver) => baseProxyHandler.get(target, key, receiver)),
        has: jest.fn((target, key) => baseProxyHandler.has(target, key)),
        ownKeys: jest.fn(target => baseProxyHandler.ownKeys(target)),
        set: jest.fn((target, key, value, receiver) =>
          baseProxyHandler.set(target, key, value, receiver)
        ),
        deleteProperty: jest.fn((target, key) => baseProxyHandler.deleteProperty(target, key)),
        construct: jest.fn((target, args, newTarget) =>
          baseProxyHandler.construct(target, args, newTarget)
        ),
      };

      const obs = observable(
        {
          // use properties in a nested object to make sure
          // that proxy traps are called when nested objects would not normally
          // be wrapped by observable (because they are not used in reaction)
          nested: {
            prop: 12,
            method: () => 12,
            ClassProp: class ClassProp {},
          },
        },
        { proxyHandlers: mockProxyHandlers }
      );

      // get trap
      expect(obs.nested.prop).toBe(12);
      // 1 for nested and 1 for props
      expect(mockProxyHandlers.get).toHaveBeenCalledTimes(2);
      jest.clearAllMocks();

      // has trap
      expect('prop' in obs.nested).toBe(true);
      expect(mockProxyHandlers.has).toHaveBeenCalledTimes(1);
      jest.clearAllMocks();

      // ownKeys trap
      // eslint-disable-next-line no-unused-vars
      for (const key in obs.nested) {
      }
      expect(mockProxyHandlers.ownKeys).toHaveBeenCalledTimes(1);
      jest.clearAllMocks();

      // delete trap
      // @ts-ignore
      delete obs.nested.prop;
      expect(obs.nested.prop).toBe(undefined);
      expect(mockProxyHandlers.deleteProperty).toHaveBeenCalledTimes(1);

      // set trap
      obs.nested.prop = 20;
      expect(obs.nested.prop).toBe(20);
      expect(mockProxyHandlers.set).toHaveBeenCalledTimes(1);
      jest.clearAllMocks();

      // construct trap
      // eslint-disable-next-line no-new
      new obs.nested.ClassProp();
      expect(mockProxyHandlers.construct).toHaveBeenCalledTimes(1);
      jest.clearAllMocks();
    });
  });

  test('should run the provided ES6 collection custom handlers', () => {
    const mockCollectionHandlers: CollectionHandlers = {
      has: jest.fn(function (this: any, key) {
        return collectionHandlers.has.call(this, key);
      }),
      get: jest.fn(function (this: any, key) {
        return collectionHandlers.get.call(this, key);
      }),
      add: jest.fn(function (this: any, key) {
        return collectionHandlers.add.call(this, key);
      }),
      set: jest.fn(function (this: any, key, value) {
        return collectionHandlers.set.call(this, key, value);
      }),
      delete: jest.fn(function (this: any, key) {
        return collectionHandlers.delete.call(this, key);
      }),
      clear: jest.fn(function (this: any) {
        return collectionHandlers.clear.call(this);
      }),
      forEach: jest.fn(function (this: any, callback, thisArg) {
        return collectionHandlers.forEach.call(this, callback, thisArg);
      }),
      keys: jest.fn(function (this: any) {
        return collectionHandlers.keys.call(this);
      }),
      values: jest.fn(function (this: any) {
        return collectionHandlers.values.call(this);
      }),
      entries: jest.fn(function (this: any) {
        return collectionHandlers.entries.call(this);
      }),
      [Symbol.iterator]: jest.fn(function (this: any) {
        return collectionHandlers[Symbol.iterator].call(this);
      }),
      size: 0,
    };

    const obsMap = observable(new Map(), {
      collectionHandlers: mockCollectionHandlers,
    });
    const obsSet = observable(new Set(), {
      collectionHandlers: mockCollectionHandlers,
    });

    // set method
    obsMap.set('prop', 1);
    expect(mockCollectionHandlers.set).toHaveBeenCalledTimes(1);
    jest.clearAllMocks();

    // add method
    obsSet.add(1);
    expect(mockCollectionHandlers.add).toHaveBeenCalledTimes(1);
    jest.clearAllMocks();

    // delete method
    obsSet.delete(1);
    expect(mockCollectionHandlers.delete).toHaveBeenCalledTimes(1);
    jest.clearAllMocks();

    // clear method
    obsSet.clear();
    expect(mockCollectionHandlers.clear).toHaveBeenCalledTimes(1);
    jest.clearAllMocks();

    // has method
    obsMap.has('prop');
    expect(mockCollectionHandlers.has).toHaveBeenCalledTimes(1);
    jest.clearAllMocks();

    // get method
    obsMap.get('prop');
    expect(mockCollectionHandlers.get).toHaveBeenCalledTimes(1);
    jest.clearAllMocks();

    // forEach method
    obsMap.forEach(() => {});
    expect(mockCollectionHandlers.forEach).toHaveBeenCalledTimes(1);
    jest.clearAllMocks();

    // keys method
    obsMap.keys();
    expect(mockCollectionHandlers.keys).toHaveBeenCalledTimes(1);
    jest.clearAllMocks();

    // values method
    obsMap.values();
    expect(mockCollectionHandlers.values).toHaveBeenCalledTimes(1);
    jest.clearAllMocks();

    // entries method
    obsMap.entries();
    expect(mockCollectionHandlers.entries).toHaveBeenCalledTimes(1);
    jest.clearAllMocks();

    // size property
    // eslint-disable-next-line no-unused-expressions
    const resSize = obsMap.size;
    expect(mockCollectionHandlers.size).toBe(0);
    jest.clearAllMocks();

    // iterator
    // eslint-disable-next-line no-unused-vars
    for (const item of obsSet) {
    }
    expect(mockCollectionHandlers[Symbol.iterator]).toHaveBeenCalledTimes(1);
    jest.clearAllMocks();
  });

  test('should run the provided transformReactions handler', () => {
    let dummy1: number | undefined;
    let dummy2: number | undefined;
    const mockReactionHandlers: ReactionHandlers = {
      transformReactions: jest.fn((target, propertyKey, reactions) => reactions),
    };
    const obj = { prop: 12 };
    const obs = observable(obj, { reactionHandlers: mockReactionHandlers });

    const reaction1 = observe(() => (dummy1 = obs.prop));
    const reaction2 = observe(() => (dummy2 = obs.prop));
    jest.clearAllMocks();

    obs.prop = 20;
    expect(mockReactionHandlers.transformReactions).toHaveBeenCalledTimes(1);
    expect(mockReactionHandlers.transformReactions).toHaveBeenCalledWith(obj, 'prop', [
      reaction1,
      reaction2,
    ]);
  });

  test('should fall back to default handlers for missing custom handlers when only some custom handlers are provided', () => {
    let dummy: number | undefined;
    // no custom get handler provided
    const obs = observable({ prop: 1 }, {});

    observe(() => (dummy = obs.prop));
    expect(dummy).toBe(1);
    obs.prop = 12;
    expect(dummy).toBe(12);
  });

  // test('should run the provided custom handlers inside ES6 collection entries', () => {
  //   const mockProxyHandlers: ProxyHandlers = {
  //     get: jest.fn((target, key, receiver) => baseProxyHandler.get(target, key, receiver)),
  //     has: jest.fn((target, key) => baseProxyHandler.has(target, key)),
  //     ownKeys: jest.fn(target => baseProxyHandler.ownKeys(target)),
  //     set: jest.fn((target, key, value, receiver) =>
  //       baseProxyHandler.set(target, key, value, receiver)
  //     ),
  //     deleteProperty: jest.fn((target, key) => baseProxyHandler.deleteProperty(target, key)),
  //     construct: jest.fn((target, args, newTarget) =>
  //       baseProxyHandler.construct(target, args, newTarget)
  //     ),
  //   };
  //   const obs = observable(new Map([['nested', { prop: 11 }]]), {
  //     proxyHandlers: mockProxyHandlers,
  //   });

  //   expect(obs.get('nested')!.prop).toBe(11);
  //   expect(mockProxyHandlers.get).toHaveBeenCalledTimes(1);
  //   jest.clearAllMocks();

  //   obs.get('nested')!.prop = 20;
  //   expect(mockProxyHandlers.set).toHaveBeenCalledTimes(1);
  //   jest.clearAllMocks();
  // });
});

describe('isObservable', () => {
  test('should return true if an observable is passed as argument', () => {
    const obs = observable();
    const isObs = isObservable(obs);
    expect(isObs).toBe(true);
  });

  test('should return false if a non observable is passed as argument', () => {
    const obj1 = { prop: 'value' };
    const obj2 = new Proxy({}, {});
    const isObs1 = isObservable(obj1);
    const isObs2 = isObservable(obj2);
    expect(isObs1).toBe(false);
    expect(isObs2).toBe(false);
  });

  test('should return false if a primitive is passed as argument', () => {
    expect(isObservable(12)).toBe(false);
  });
});

describe('raw', () => {
  test('should return the raw non-reactive object', () => {
    const obj = {};
    const obs = observable(obj);
    expect(raw(obs)).toBe(obj);
    expect(raw(obj)).toBe(obj);
  });

  test('should work with plain primitives', () => {
    expect(raw(12 as any)).toBe(12);
  });
});
