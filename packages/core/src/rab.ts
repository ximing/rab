import 'reflect-metadata';
import { Container } from 'inversify';
import { Middleware } from 'redux';
import { Model, IModel } from './model';
import { ReduceManager } from './reduceManager';
import { ReduxStore } from './store';
import { Plugin } from './plugin';

export class Rab {
    private middlewares: Middleware[];
    container: Container;
    reduceManager: ReduceManager;
    reduxStore: ReduxStore;
    plugins: Plugin[];
    extraReducers: any;

    constructor(options) {
        const { middlewares = [], extraReducers = {} } = options;
        this.middlewares = middlewares;
        this.container = new Container({ defaultScope: 'Singleton' });
        this.reduxStore = new ReduxStore(this);
        this.reduceManager = new ReduceManager(this);
        this.extraReducers = extraReducers;
    }

    use(plugin: Plugin) {
        this.plugins.push(plugin);
    }

    addModel<S>(ModelClass: IModel<S>) {
        this.container.bind<Model<S>>(ModelClass).to(ModelClass);
        this.reduceManager.addReduce(ModelClass);
    }

    getModel<S, T extends Model<S>>(ModelClass: new() => T): T {
        return this.container.get(ModelClass);
    }

    start() {
        this.plugins.forEach((plugin) => {
            plugin.beforeStart && plugin.beforeStart(this);
        });
        this.reduxStore.createReduxStore(this.middlewares, this.reduceManager.reduces, { extraReducers: this.extraReducers });
        this.plugins.forEach((plugin) => {
            plugin.afterStart && plugin.afterStart(this);
        });
    }

    getStore() {
        return this.reduxStore.getReduxStore();
    }
}

