import {isFSA} from 'flux-standard-action';

import {KEY} from '../constants';
import {put, call} from '../lib';
import {Action} from '../interface';

function isPromise(obj) {
    return !!obj && typeof obj.then === 'function';
}

function callStartReducer(dispatch, action:Action) {
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

export default (debug) => ({dispatch, getState}) => next => (action:Action|any) => {
    if (!isFSA(action)) {
        if (typeof action === 'function') {
            return action({dispatch, getState, put, call});
        } else {
            return next(action);
        }
    } else if (typeof action.payload === 'function' && !isPromise(action.payload)) {
        let res = action.payload({dispatch, getState, put, call});
        if (isPromise(res)) {
            callStartReducer(dispatch, action as Action);
            return res.then(
                (result) => {
                    dispatch({
                        ...action,
                        payload: result
                    });
                    return result
                },
                (error) => {
                    dispatch({
                        ...action,
                        payload: error,
                        error: true
                    });
                    if (debug) {
                        throw error;
                    } else {
                        return error
                    }
                }
            );
        } else {
            return dispatch({
                ...action,
                payload: res
            });
        }
    } else if (isPromise(action.payload)) {
        callStartReducer(dispatch, action);
        return action.payload.then(
            (result) => {
                dispatch({
                    ...action,
                    payload: result
                });
                return result;
            },
            (error) => {
                dispatch({
                    ...action,
                    payload: error,
                    error: true
                });
                if (debug) {
                    throw error;
                } else {
                    return error;
                }
            }
        );
    } else {
        next(action);
    }
};
