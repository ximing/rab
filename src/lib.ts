/**
 * Created by yeanzhi on 17/3/9.
 */
'use strict';
import {getReduxStore} from './store';
import {getAction} from './actions';

export const dispatch = function (args) {
    if(getReduxStore()) {
        return getReduxStore().dispatch(args);
    }else{
        throw new Error('could not call dispatch before init store');
    }
};

export const getState = function (args) {
    if(getReduxStore()) {
        return getReduxStore().getState(args);
    }else{
        throw new Error('could not call getState before init store');
    }
};

export const call = function(type, ...args) {
    if(getAction(type)) {
        return dispatch(getAction(type)(...args));
    }else{
        return dispatch({
            type,
            payload:{...args}
        });
    }
};

export const put = function({type,payload}) {
    if(getAction(type)) {
        return dispatch(getAction(type)(payload || {}));
    }else{
        return dispatch({
            type,
            payload
        });
    }
};
