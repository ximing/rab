import { combineReducers } from 'redux';
import produce from 'immer';
import { IModel } from './model';
import { getActionNames } from './decorators';
import { immerReducerSymbols, reducerSymbols, ModelNamespaceSymbol, defineActionSymbols } from './symbols';
import { Rab } from './rab';

export class ReduceManager {
    rab: Rab;
    reduces: { [key: string]: Function };

    constructor(rab: Rab) {
        this.rab = rab;
    }

    createActionFunction(reduceName) {
        return (state, params) => {
            this.rab.reduxStore.getReduxStore().dispatch({
                type: reduceName,
                params
            });
        };
    }

    addActionFunction(target, actionName, actionFunction) {
        const actions = target.getActions(target);
        actions[actionName] = actionFunction;
        return Reflect.defineMetadata(defineActionSymbols.decorator, actions, target);
    }

    addReduce<S>(ModelClass: IModel<S>) {
        const reduceNames = getActionNames(reducerSymbols, ModelClass.constructor);
        const immerReduceNames = getActionNames(immerReducerSymbols, ModelClass.constructor);
        const model = this.rab.getModel(ModelClass);
        const namespace = Reflect.getMetadata(ModelNamespaceSymbol, ModelClass);
        const reduce = {};
        reduceNames.forEach(name => {
            const reduceName = `@${namespace}/${name}`;
            const reduceFunction = model[name].bind(model);
            reduce[reduceName] = (params) => (state) => reduceFunction(state, params);
            model[name] = this.createActionFunction(reduceName);
            this.addActionFunction(model, reduceName, this.createActionFunction(reduceName));
        });
        immerReduceNames.forEach(name => {
            const reduceName = `@${namespace}/${name}`;
            const reduceFunction = model[name].bind(model);
            reduce[reduceName] = (params) => (state) => {
                return produce(state, draft => {
                    reduceFunction(draft, params);
                });
            };
            model[name] = this.createActionFunction(reduceName);
            this.addActionFunction(model, reduceName, this.createActionFunction(reduceName));
        });
        this.reduces[namespace] = (state, payload) => {
            if (reduce[payload.type]) {
                return reduce[payload.type](payload.params)(state);
            }
            return state;
        };
        this.rab.reduxStore.initialState[namespace] = Object.assign({}, model.state);
    }

}