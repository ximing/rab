import { pick, mapValues } from './helpers';

import {
    OriginalEffectActions,
    OriginalReducerActions,
    OriginalImmerReducerActions
} from '../types';
import { Service } from '../service';
import { getActionNames } from '../decorators';

import { effectSymbols, reducerSymbols, immerReducerSymbols } from '../symbols';

const getOriginalFunctionNames = (service: Service<any>) => ({
    effects: getActionNames(effectSymbols, service.constructor),
    reducers: getActionNames(reducerSymbols, service.constructor),
    immerReducers: getActionNames(immerReducerSymbols, service.constructor)
});

export const getOriginalFunctions = (service: Service<any>) => {
    const { effects, reducers, immerReducers } = getOriginalFunctionNames(service);
    return {
        effects: mapValues(pick(service, effects), (func: any) =>
            func.bind(service)
        ) as OriginalEffectActions<any>,
        reducers: mapValues(pick(service, reducers), (func: any) =>
            func.bind(service)
        ) as OriginalReducerActions<any>,
        immerReducers: mapValues(pick(service, immerReducers), (func: any) =>
            func.bind(service)
        ) as OriginalImmerReducerActions<any>
    };
};
