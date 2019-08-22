import { injectable } from 'inversify';
import {
    allActionSymbols,
    defineActionSymbols,
    effectSymbols,
    reducerSymbols,
    immerReducerSymbols,
    actionSymbols,
    subscribeSymbols,
    ModelNamespaceSymbol
} from './symbols';

function addActionName(symbols, constructor, actionName) {
    const decoratedActionNames = Reflect.getMetadata(symbols.decorator, constructor) || [];
    Reflect.defineMetadata(symbols.decorator, [...decoratedActionNames, actionName], constructor);
}

export function createActionDecorator(symbols) {
    return () => ({ constructor }, propertyKey) => {
        addActionName(symbols, constructor, propertyKey);
    };
}

export function getActionNames(symbols, constructor) {
    return Reflect.getMetadata(symbols.decorator, constructor) || [];
}

export function getAllActionNames(instance) {
    return allActionSymbols.reduce((result, symbols) => [...result, ...getActionNames(symbols, instance.constructor)], []);
}


export const immerReducer = createActionDecorator(immerReducerSymbols);
export const reducer = createActionDecorator(reducerSymbols);
export const effect = createActionDecorator(effectSymbols);
export const action = createActionDecorator(actionSymbols);
export const defineAction = createActionDecorator(defineActionSymbols);
export const subscribeAction = createActionDecorator(subscribeSymbols);

export const model = (namespace: string) => function classDecorator(target) {
    if (!namespace) {
        throw new Error('namespace不能为空，请使用@model(namespace)添加注解');
    }
    if (typeof namespace !== 'string') {
        throw new Error('@model(namespace) 中namespace必须为string');
    }
    if (Reflect.hasOwnMetadata(ModelNamespaceSymbol, target)) {
        throw new Error('Cannot apply @model decorator multiple times.');
    }
    injectable()(target);
    Reflect.defineMetadata(ModelNamespaceSymbol, namespace, target);
    return target;
};