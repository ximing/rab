"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var _ = require("lodash");
var invariant = require("invariant");
var combineActions_1 = require("./combineActions");
var constants_1 = require("../constants");
var identity = _.identity;
var isFunction = _.isFunction;
var isUndefined = _.isUndefined;
var isNil = _.isNil;
var isPlainObject = _.isPlainObject;
var includes = _.includes;
function safeMap(state, fn, action) {
    switch (typeof fn) {
        case 'function': {
            var result = fn(state, action);
            return result;
        }
        default:
            return state;
    }
}
function handleAction(type, reducer, defaultState) {
    if (reducer === void 0) { reducer = identity; }
    var types = type.toString().split(combineActions_1.ACTION_TYPE_DELIMITER);
    invariant(!isUndefined(defaultState), "defaultState for reducer handling " + types.join(', ') + " should be defined");
    invariant(isFunction(reducer) || isPlainObject(reducer), 'Expected reducer to be a function or object with next and throw reducers');
    var _a = isFunction(reducer)
        ? [identity, reducer, reducer, identity]
        : [reducer.start, (reducer.next || reducer.success),
            (reducer.throw || reducer.error), reducer.finish]
            .map(function (aReducer) { return (isNil(aReducer) ? identity : aReducer); }), startReducer = _a[0], nextReducer = _a[1], throwReducer = _a[2], finishReducer = _a[3];
    return function (state, action) {
        if (state === void 0) { state = defaultState; }
        var actionType = action.type, meta = action.meta;
        var lifecycle = meta ? meta[constants_1.KEY.LIFECYCLE] : null;
        if (!actionType || !includes(types, actionType.toString())) {
            return state;
        }
        if (lifecycle === 'start') {
            state = safeMap(state, startReducer, action);
        }
        else {
            if (action.error === true && ((identity === throwReducer) || (nextReducer === throwReducer))) {
                throw action.payload;
            }
            state = (action.error === true ? throwReducer : nextReducer)(state, action);
            state = safeMap(state, finishReducer, action);
        }
        return state;
    };
}
exports.default = handleAction;
