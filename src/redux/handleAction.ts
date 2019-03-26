import * as _ from 'lodash';
import * as invariant from 'invariant';

import {ACTION_TYPE_DELIMITER} from './combineActions';
import {KEY} from '../constants';
import {reducerFunc,reducerObj} from '../interface';

const identity = _.identity;
const isFunction = _.isFunction;
const isUndefined = _.isUndefined;
const isNil = _.isNil;
const isPlainObject = _.isPlainObject;
const includes = _.includes;

function safeMap(state, fn, action) {
    switch (typeof fn) {
        case 'function': {
            const result = fn(state, action);
            return result;
        }
        default:
            return state;
    }
}


export default function handleAction(type:string, reducer : reducerFunc<any> | reducerObj<any> = identity, defaultState:object) {
    const types = type.toString().split(ACTION_TYPE_DELIMITER);
    invariant(
        !isUndefined(defaultState),
        `defaultState for reducer handling ${types.join(', ')} should be defined`
    );
    invariant(
        isFunction(reducer) || isPlainObject(reducer),
        'Expected reducer to be a function or object with next and throw reducers'
    );

    const [startReducer, nextReducer, throwReducer, finishReducer] = isFunction(reducer)
        ? [identity, reducer, reducer, identity]
        : [reducer.start, (reducer.next || reducer.success),
            (reducer.throw || reducer.error), reducer.finish]
            .map(aReducer => (isNil(aReducer) ? identity : aReducer));

    return (state = defaultState, action) => {
        const {type: actionType, meta} = action;
        const lifecycle = meta ? meta[KEY.LIFECYCLE] : null;
        if (!actionType || !includes(types, actionType.toString())) {
            return state;
        }
        if (lifecycle === 'start') {
            state = safeMap(state, startReducer, action);
        } else {
            if (action.error === true && ((identity === throwReducer) || (nextReducer === throwReducer))) {
                throw action.payload;
            }
            state = (action.error === true ? throwReducer : nextReducer)(state, action);
            state = safeMap(state, finishReducer, action);
        }
        return state;
    };
}
