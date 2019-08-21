export class Model<S> {
    state: S;
}

export interface IModel<S> {
    new (): Model<S>;
}