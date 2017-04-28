/**
 * Created by yeanzhi on 17/3/9.
 */
'use strict';
import {getReduxStore} from './store';
import {getAction} from './actions';

const dispatch = function (args) {
    if(getReduxStore()){
        getReduxStore().dispatch(args)
    }else{
        throw new Error('could not call dispatch before init store')
    }
};

const getState = function (args) {
    if(getReduxStore()){
        getReduxStore().getState(args)
    }else{
        throw new Error('could not call getState before init store')
    }
};

const call = function(type, ...args) {
    if(getAction(type)){
        dispatch(getAction(type)(...args))
    }else{
        dispatch({
            type,
            payload:{...args}
        })
    }
}

const put = function({type,payload}) {
    if(getAction(type)){
        dispatch(getAction(type)(payload||{}))
    }else{
        dispatch({
            type,
            payload
        })
    }
}
export default {
    dispatch,getState,call,put
}
