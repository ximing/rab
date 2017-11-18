import {isFSA} from 'flux-standard-action';
import {KEY} from '../constants';

import {put, call} from '../lib';

function isPromise(obj) {
    return !!obj && typeof obj.then === 'function';
}

function callStartReducer(dispatch, action) {
    if (action.type) {
        dispatch({
            type: action.type,
            payload: action.meta['action-redux/payload'] || {},
            meta: {
                ...action.meta,
                [KEY.LIFECYCLE]: 'start'
            }
        });
    }
}

export default (debug) => ({dispatch, getState}) => next => action => {
    if (!isFSA(action)) {
        if (typeof action === 'function') {
            if (isPromise(action)) {
                callStartReducer(dispatch, action);
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
                        if(debug){
                            throw error;
                        }
                    }
                );
            } else {
                return action({dispatch, getState, put, call});
            }
        } else {
            return next(action);
        }
    } else {
        if (typeof action.payload === 'function' && !isPromise(action.payload)) {
            let res = action.payload({dispatch, getState, put, call});
            if (isPromise(res)) {
                callStartReducer(dispatch, action);
                res.then(
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
                        if(debug){
                            throw error;
                        }
                    }
                );
            } else {
                dispatch({
                    ...action,
                    payload: res
                });
            }
        } else {
            if (isPromise(action.payload)) {
                callStartReducer(dispatch, action);
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
                        if(debug){
                            throw error;
                        }
                    }
                );
            } else {
                next(action);
            }
        }
    }
};
