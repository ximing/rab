import uuid from 'uuid';
import {isFSA}from 'flux-standard-action';

function isPromise(obj) {
    return !!obj && typeof obj.then === 'function';
}

export default ({dispatch, getState}) => next => action => {
    // console.log(action,'dd'.repeat(10));
    if (!isFSA(action)) {
        // console.log('sss')
        if (typeof action === 'function') {
            if (isPromise(action)) {
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
        // console.log(action,'ac'.repeat(10));
        if (isPromise(action.payload)) {
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
