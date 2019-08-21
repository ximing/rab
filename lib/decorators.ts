import {
    allActionSymbols,
    defineActionSymbols,
    effectSymbols,
    reducerSymbols,
    immerReducerSymbols,
    actionSymbols,
    subscribeSymbols
} from './symbols';

function addActionName(symbols, constructor, actionName) {
    const decoratedActionNames = Reflect.getMetadata(symbols.decorator, constructor) || [];
    Reflect.defineMetadata(symbols.decorator, [...decoratedActionNames, actionName], constructor);
}

export function createActionDecorator(symbols) {
    return ({ constructor }, propertyKey) => {
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
