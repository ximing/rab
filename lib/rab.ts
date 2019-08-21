import 'reflect-metadata';
import { Container } from 'inversify';
import { combineReducers } from 'redux';
import { Model, IModel } from './model';
import { getActionNames, reducer } from './decorators';
import {
    allActionSymbols,
    defineActionSymbols,
    effectSymbols,
    reducerSymbols,
    immerReducerSymbols,
    actionSymbols,
    subscribeSymbols
} from './symbols';
import { ReduceManager } from './reduceManager';
import { ReduxStore } from './store';

export class Rab {
    container: Container;
    reduceManager: ReduceManager;
    reduxStore: ReduxStore;

    constructor() {
        this.container = new Container({ defaultScope: 'Singleton' });
        this.reduxStore = new ReduxStore(this);
        this.reduceManager = new ReduceManager(this);
    }

    addModel<S>(ModelClass: IModel<S>) {
        this.container.bind<Model<S>>(ModelClass).to(ModelClass);
        this.reduceManager.addReduce(ModelClass);
    }

    getModel<S>(ModelClass: IModel<S>) {
        return this.container.resolve(ModelClass);
    }

    start() {
    }

}

