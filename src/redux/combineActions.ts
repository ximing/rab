import * as _ from 'lodash';
import * as invariant from 'invariant';

const isEmpty = _.isEmpty;
const isFunction = _.isFunction;
const isString = _.isString;
const isSymbol = _.isSymbol;
const toString = _.toString;

export const ACTION_TYPE_DELIMITER = '||';

function isValidActionType(type) {
    return isString(type) || isFunction(type) || isSymbol(type);
}

function isValidActionTypes(types) {
    if (isEmpty(types)) {
        return false;
    }
    return types.every(isValidActionType);
}

export default function combineActions(...actionsTypes) {
    invariant(
        isValidActionTypes(actionsTypes),
        'Expected action types to be strings, symbols, or action creators'
    );
    const combinedActionType = actionsTypes.map(toString).join(ACTION_TYPE_DELIMITER);
    return { toString: () => combinedActionType };
}
