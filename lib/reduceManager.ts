import { combineReducers } from 'redux';
import produce from 'immer';
import { IModel } from './model';
import { getActionNames } from './decorators';
import {
    immerReducerSymbols,
    reducerSymbols,
    ModelNamespaceSymbol,
    defineActionSymbols,
    actionSymbols,
    subscribeSymbols
} from './symbols';
import { Rab } from './rab';
import { ReducerAction, ModelAction } from './interfaces';
import { ACTIONS } from './constants';

export class ReduceManager {
    rab: Rab;
    reduces: { [key: string]: Function };

    constructor(rab: Rab) {
        this.rab = rab;
        this.reduces = {};
    }

    private createActionFunction(reduceName: string | symbol, namespace: string, actionName: string) {
        return (params) => {
            this.rab.reduxStore.getReduxStore().dispatch({
                type: reduceName, params, namespace, actionName
            });
        };
    }

    private addActionFunction(target, actionName, actionFunction) {
        const actions = target.getActions();
        actions[actionName] = actionFunction;
        return Reflect.defineMetadata(defineActionSymbols.decorator, actions, target);
    }

    addReduce<S>(ModelClass: IModel<S>) {
        const reduceNames = getActionNames(reducerSymbols, ModelClass);
        const immerReduceNames = getActionNames(immerReducerSymbols, ModelClass);
        const actionNames = getActionNames(actionSymbols, ModelClass);
        const model = this.rab.getModel(ModelClass);
        const namespace = Reflect.getMetadata(ModelNamespaceSymbol, ModelClass);
        const reduce = {};
        reduceNames.forEach(name => {
            const reduceName = `@${namespace}/${name}`;
            const reduceFunction = model[name].bind(model);
            reduce[reduceName] = (params) => (state) => reduceFunction(state, params);
            model[name] = this.createActionFunction(reduceName, namespace, name);
            this.addActionFunction(model, name, model[name]);
        });
        immerReduceNames.forEach(name => {
            const reduceName = `@${namespace}/${name}`;
            const reduceFunction = model[name].bind(model);
            reduce[reduceName] = (params) => (state) => {
                return produce(state, draft => {
                    reduceFunction(draft, params);
                });
            };
            model[name] = this.createActionFunction(reduceName, namespace, name);
            this.addActionFunction(model, name, model[name]);
        });
        actionNames.forEach(name => {
            const actionFunction = model[name].bind(model);
            const dispatchFunction = this.createActionFunction(ACTIONS.RAB_ACTION_REDUCE, namespace, name);
            model[name] = async (params) => {
                const newState = await produce(model.getState(), async draft => {
                    await actionFunction(draft, params);
                });
                dispatchFunction(newState);
            };
            this.addActionFunction(model, name, model[name]);
        });
        this.reduces[namespace] = (state = model.getState(), payload) => {
            if (reduce[payload.type]) {
                return reduce[payload.type](payload.params)(state);
            }
            if (payload.type === ACTIONS.RAB_ACTION_REDUCE) {
                return payload.params;
            }
            return state;
        };
        this.rab.reduxStore.initialState[namespace] = Object.assign({}, model.getState());
    }

}