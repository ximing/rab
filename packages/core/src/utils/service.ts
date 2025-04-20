import { isObservable, makeAutoObservable } from 'mobx';
import { debounceDecorator, serviceDecorator } from '../symbols';
import { debounce } from './debounce';
import { isPromise } from './helpers';

const rawToObservable = new WeakMap();

export const getObserverService = (service: any) => {
  if (isServiceDecorated(service) && !isObservable(service)) {
    if (rawToObservable.get(service)) {
      return rawToObservable.get(service);
    }
    // 确保 $model 属性存在
    if (!service.$model) {
      service.$model = {};
    }

    const keys = Reflect.ownKeys(Object.getPrototypeOf(service))
      .filter((item) => item !== 'constructor')
      .concat(Reflect.ownKeys(service));
    try {
      keys.forEach((item) => {
        const self = service as any;
        if (typeof self[item] === 'function') {
          self.$model[item] = {
            loading: false,
            error: null,
          };
          let originFn = self[item];
          const debounceDuration = Reflect.getMetadata(debounceDecorator, service, item as string);
          if (debounceDuration) {
            originFn = debounce(originFn, debounceDuration);
          }
          self[item] = function (...args: any[]) {
            const res = originFn.apply(this, args);
            if (isPromise(res)) {
              // const observableService = Reflect.getMetadata(ServiceObserver, this);
              this.$model[item].loading = true;
              if (this.$model[item].error) {
                this.$model[item].error = null;
              }
              return res.then(
                (res: any) => {
                  this.$model[item].loading = false;
                  return res;
                },
                (err: any) => {
                  this.$model[item].loading = false;
                  this.$model[item].error = err;
                  throw err;
                }
              );
            } else {
              return res;
            }
          };
        }
      });
    } catch (e) {
      console.error(e);
    }
    const observerService = makeAutoObservable(service);

    rawToObservable.set(service, observerService);
    return observerService;
  }
  return service;
};

/**
 * Check if a class or instance is decorated with @Service decorator
 * @param target The class constructor or instance to check
 * @returns boolean indicating if the class is decorated with @Service
 */
export const isServiceDecorated = (target: any): boolean => {
  if (!target) {
    return false;
  }

  // 如果是实例对象，获取其构造函数
  const constructor = typeof target === 'function' ? target : target.constructor;

  // 检查构造函数是否有 Injectable 元数据
  const hasInjectableMetadata = Reflect.getMetadata('injectable', constructor);

  // 检查构造函数是否有 Service 元数据
  const hasServiceMetadata = Reflect.getMetadata(serviceDecorator, constructor);

  // 如果任一元数据存在，则类被 @Service 装饰
  return Boolean(hasInjectableMetadata || hasServiceMetadata);
};
