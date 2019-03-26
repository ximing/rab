/**
 * Created by yeanzhi on 17/4/27.
 */
'use strict';
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var _ = require("lodash");
var invariant = require("invariant");
var identity = _.identity;
var isFunction = _.isFunction;
var isUndefined = _.isUndefined;
var isNull = _.isNull;
function createAction(type, payloadCreator, metaCreator) {
    if (payloadCreator === void 0) { payloadCreator = identity; }
    invariant(isFunction(payloadCreator) || isNull(payloadCreator), 'Expected payloadCreator to be a function, undefined or null');
    var finalPayloadCreator = isNull(payloadCreator)
        ? identity
        : payloadCreator;
    var actionCreator = function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        var hasError = args[0] instanceof Error;
        var action = {
            type: type,
            meta: {
                'action-redux/payload': args.slice()
            },
        };
        var payload = hasError ? args[0] : finalPayloadCreator.apply(void 0, args);
        if (!isUndefined(payload)) {
            action.payload = payload;
        }
        if (hasError || payload instanceof Error) {
            // Handle FSA errors where the payload is an Error object. Set error.
            action.error = true;
        }
        if (isFunction(metaCreator)) {
            action.meta = Object.assign(action.meta, __assign({}, metaCreator.apply(void 0, args)));
        }
        return action;
    };
    actionCreator.toString = function () { return type.toString(); };
    return actionCreator;
}
exports.default = createAction;
