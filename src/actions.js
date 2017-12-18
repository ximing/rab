/**
 * Created by yeanzhi on 17/4/28.
 */
'use strict';
import warning from 'warning';
import {SEP} from './constants';

//all actions in models
let actions = {};

export const setAction = function (type, action) {
    warning(!actions[type], `action ${type} init multiple times`);
    actions[type] = action;
};

export const removeActions = function (namespace) {
    Object.keys(actions).forEach(actionKey => {
        if (actionKey.indexOf(`${namespace}${SEP}`) === 0) {
            delete actions[actionKey]
        }
    })
};

export const getAction = function (type) {
    return actions[type];
};
