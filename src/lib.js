/**
 * Created by yeanzhi on 17/3/9.
 */
'use strict';
import {getReduxStore} from './store';

export const call = function(type, payload) {
    return {
        type: type,
        payload: payload
    }
}
export const put = function(type,payload) {
    return {
        type
    }
}

export const dispacth = function (args) {
    if(getReduxStore().store){
        getReduxStore().store.dispatch(...args)
    }else{
        throw new Error('could not call dispatch before init store')
    }
};

export const getState = function (args) {
    if(getReduxStore().store){
        getReduxStore().store.getState(...args)
    }else{
        throw new Error('could not call getState before init store')
    }
};

