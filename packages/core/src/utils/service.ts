import { isObservable, observable } from '@rabjs/observer-util';
import { Service } from '../service';
import { batchMethods } from '../react/batch';

const rawToObservable = new WeakMap();

export const getObserverService = (service: any) => {
  if (service instanceof Service && !isObservable(service)) {
    if (rawToObservable.get(service)) {
      return rawToObservable.get(service);
    }
    // 提前将需要遍历的函数取出来，如果从observerService取，将会触发所有的get，observer将不准确
    const keys = Reflect.ownKeys(Object.getPrototypeOf(service))
      .concat(Reflect.ownKeys(service))
      .filter((item) => {
        return (
          item !== 'constructor' &&
          item !== '__init__' &&
          typeof (service as any)[item] === 'function'
        );
      });
    const observerService = batchMethods(observable(service));
    keys.forEach((item) => {
      const self = observerService as any;
      Object.defineProperty(self, item, {
        value: self[item].bind(observerService),
        writable: true,
      });
      // 按照如下的写法将会在 类组件注入service的时候报错
      // self[item] = self[item].bind(self);
    });
    rawToObservable.set(service, observerService);
    return observerService;
  }
  return service;
};
