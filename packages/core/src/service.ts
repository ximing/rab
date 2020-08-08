import 'reflect-metadata';
import { postConstruct } from 'inversify';
import { Injectable, ServiceMeta } from '@rabjs/ioc';
import { isPromise } from './utils/helpers';
// import { batchMethod } from './react/batch';

@Injectable()
export class Service {
  public $model: any = {};

  private setUpActions() {
    Reflect.ownKeys(Object.getPrototypeOf(this))
      .filter((item) => item !== 'constructor')
      .concat(Reflect.ownKeys(this))
      .forEach((item) => {
        const self = this as any;
        // if (isAsyncFunction(self[item]) || isPromise(self[item])) {
        //   self.$model[item] = {
        //     loading: false,
        //     error: null,
        //   };
        //   const originFn = self[item];
        //   self[item] = async (...args: any[]) => {
        //     const observableService = Reflect.getMetadata(ServiceObserver, this);
        //     try {
        //       observableService.$model[item].loading = true;
        //       await originFn.apply(this, args);
        //       observableService.$model[item].loading = false;
        //     } catch (e) {
        //       observableService.$model[item].loading = false;
        //       observableService.$model[item].error = e;
        //       throw e;
        //     }
        //   };
        // }
        if (typeof self[item] === 'function') {
          // batchMethod(self, item);
          self.$model[item] = {
            loading: false,
            error: null,
          };
          const originFn = self[item];
          // 会在container.ts 中 bind this 到被代理的service上
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
  }

  @postConstruct()
  __init__() {
    this.setUpActions();
    Reflect.defineMetadata(
      ServiceMeta,
      {
        destory() {},
      },
      this
    );
  }
}
