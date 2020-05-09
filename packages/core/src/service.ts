import 'reflect-metadata';
import { postConstruct } from 'inversify';
import { Injectable } from './ioc';
import { isAsyncFunction, isPromise } from './utils/helpers';
import { ServiceMeta, ServiceObserver } from './symbols';
import { batchMethod } from './react/batch';

@Injectable()
export class Service {
  public $model: any = {};

  private setUpActions() {
    Reflect.ownKeys(Object.getPrototypeOf(this))
      .filter((item) => item !== 'constructor')
      .concat(Reflect.ownKeys(this))
      .forEach((item) => {
        console.log('setUpActions', item);
        const self = this as any;
        if (isAsyncFunction(self[item]) || isPromise(self[item])) {
          self.$model[item] = {
            loading: false,
            error: null
          };
          const originFn = self[item];
          self[item] = async (...args: any[]) => {
            const observableService = Reflect.getMetadata(ServiceObserver, this);
            try {
              observableService.$model[item].loading = true;
              await originFn.apply(this, args);
              observableService.$model[item].loading = false;
            } catch (e) {
              observableService.$model[item].loading = false;
              observableService.$model[item].error = e;
              throw e;
            }
          };
        }
        if (typeof self[item] === 'function') {
          batchMethod(self, item);
        }
      });
  }

  @postConstruct()
  __init__() {
    this.setUpActions();
    Reflect.defineMetadata(
      ServiceMeta,
      {
        destory() {}
      },
      this
    );
  }
}
