import uuid from 'uuid';
import {isFSA}from 'flux-standard-action';
import { KEY } from '../constants';

function isPromise(obj) {
    return !!obj && typeof obj.then === 'function';
}

export default ({dispatch, getState}) => next => action => {
    if (!isFSA(action)) {
        if (typeof action === 'function') {
            if (isPromise(action)) {
                if(action.type){
                    dispatch({
                        type:action.type,
                        payload:{},
                        meta:{
                            ...action.meta,
                            [KEY.LIFECYCLE]:'start'
                        }
                    });
                }
                action.then(
                    (result) => {
                        dispatch({
                            ...action,
                            ...result
                        });
                    },
                    (error) => {
                        dispatch({
                            error: true,
                            ...action,
                            ...error
                        });
                    }
                );
            } else {
                return action(dispatch, getState);
            }
        } else {
            return next(action);
        }
    } else  {
        if (isPromise(action.payload)) {
            if(action.type){
                dispatch({
                    type:action.type,
                    payload:{},
                    meta:{
                        ...action.meta,
                        [KEY.LIFECYCLE]:'start'
                    }
                });
            }
            action.payload.then(
                (result) => {
                    dispatch({
                        ...action,
                        payload: result
                    });
                },
                (error) => {
                    dispatch({
                        ...action,
                        payload: error,
                        error: true
                    });
                }
            );
        } else {
            next(action);
        }
    }
};
