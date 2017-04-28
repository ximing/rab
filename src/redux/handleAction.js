import _ from 'lodash';
const identity = _.identity;
const isFunction = _.isFunction;
const isUndefined = _.isUndefined;
const isNil = _.isNil;
const isPlainObject = _.isPlainObject;
const includes = _.includes;
import invariant from 'invariant';
import { ACTION_TYPE_DELIMITER } from './combineActions';
import { KEY } from '../constants';


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


export default function handleAction(type, reducer = identity, defaultState) {
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
    : [reducer.start, reducer.next,
      reducer.throw, reducer.finish].map(aReducer => (isNil(aReducer) ? identity : aReducer));

  return (state = defaultState, action) => {
    const { type: actionType, meta } = action;
    const lifecycle = meta ? meta[KEY.LIFECYCLE] : null;
    if (!actionType || !includes(types, actionType.toString())) {
      return state;
    }
    if (lifecycle === 'start') {
      state = safeMap(state, startReducer, action);
    } else {
      state = (action.error === true ? throwReducer : nextReducer)(state, action);
      state = safeMap(state, finishReducer, action);
    }
    return state;
  };
}
