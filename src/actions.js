/**
 * Created by yeanzhi on 17/4/28.
 */
'use strict';
import warning from 'warning';

//all actions in models
let actions = {};

export const setAction = function (type,action) {
    console.log('aa',type, action())
    warning(!actions[type], `action ${type} init multiple times`);
    actions[type] = action;
}

export const getAction = function (type) {
    return actions[type]
}
