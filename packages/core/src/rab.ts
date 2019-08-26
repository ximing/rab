import { Container } from 'inversify';
import { Middleware } from 'redux';
import { Model, IModel } from './model';
import { ReduceManager } from './reduceManager';
import { ReduxStore } from './store';
import { Plugin } from './plugin';

export interface RabConstructorOptions {
    middlewares?: any[],
    extraReducers?: any
}

export class Rab {
    private middlewares: Middleware[];
    protected routerMiddleware: any;
    container: Container;
    reduceManager: ReduceManager;
    reduxStore: ReduxStore;
    plugins: Plugin[] = [];
    extraReducers: any = {};
    isInit: boolean = false;

    constructor({ middlewares = [], extraReducers = {} }: RabConstructorOptions = {}) {
        this.middlewares = middlewares;
        this.container = new Container({ defaultScope: 'Singleton' });
        this.reduxStore = new ReduxStore(this);
        this.reduceManager = new ReduceManager(this);
        this.extraReducers = extraReducers;
    }

    use<P extends Plugin>(plugin: P) {
        this.plugins.push(plugin);
    }

    addModel<S>(ModelClass: IModel<S>) {
        this.container.bind<Model<S>>(ModelClass).to(ModelClass);
        this.reduceManager.addModelToReduce(ModelClass);
    }

    getModel<S, T extends Model<S>>(ModelClass: new() => T): T {
        return this.container.get(ModelClass);
    }

    start() {
        if (this.isInit) {
            throw new Error('already start，Do not call the start repeatedly');
        }
        this.plugins.forEach((plugin) => {
            plugin.beforeStart && plugin.beforeStart(this);
        });
        this.reduxStore.createReduxStore(this.middlewares, this.reduceManager.reduces, {
            extraReducers: this.extraReducers,
            routerMiddleware: this.routerMiddleware
        });
        this.plugins.forEach((plugin) => {
            plugin.afterStart && plugin.afterStart(this);
        });
        this.isInit = true;
    }

    getStore() {
        return this.reduxStore.getReduxStore();
    }
}

