import { defineActionSymbols } from './symbols';

export class Model<S> {
    state: S;
    getActions: <M extends Model<S>>(this: M) => M extends Model<infer S> ? ActionOfService<M, S> : never;

    // getActions<M extends Model<S>>(this: M) => M extends Model<infer S> ? ActionOfService<M, S> : never{
    //     const actions = Reflect.getMetadata(defineActionSymbols.decorator, this) || {};
    //     return actions;
    // };

}

export interface IModel<S> {
    new(): Model<S>;
}