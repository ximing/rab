/**
 * Created by yeanzhi on 17/4/27.
 */
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var _ = require("lodash");
var invariant = require("invariant");
var isString = _.isString;
var isFunction = _.isFunction;
var isEmpty = _.isEmpty;
var isSymbol = _.isSymbol;
var toString = _.toString;
exports.ACTION_TYPE_DELIMITER = '||';
function isValidActionType(type) {
    return isString(type) || isFunction(type) || isSymbol(type);
}
function isValidActionTypes(types) {
    if (isEmpty(types)) {
        return false;
    }
    return types.every(isValidActionType);
}
function combineActions() {
    var actionsTypes = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        actionsTypes[_i] = arguments[_i];
    }
    invariant(isValidActionTypes(actionsTypes), 'Expected action types to be strings, symbols, or action creators');
    var combinedActionType = actionsTypes.map(toString).join(exports.ACTION_TYPE_DELIMITER);
    return { toString: function () { return combinedActionType; } };
}
exports.default = combineActions;
