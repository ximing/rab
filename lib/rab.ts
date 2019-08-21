import 'reflect-metadata';
import { Container } from 'inversify';
import { combineReducers } from 'redux';
import { Model, IModel } from './model';

export class Rab {
    container: Container;

    constructor() {
        this.container = new Container({ defaultScope: 'Singleton' });
    }

    addModel<S>(ModelClass: IModel<S>) {
        this.container.bind<Model<S>>(ModelClass).to(ModelClass);
    }

    start() {
    }

}
//
// class M extends Model<{
//     name: string
// }> {
// }
//
// const rab = new Rab();
// rab.addModel(M);
// rab.container.resolve(M).state.name