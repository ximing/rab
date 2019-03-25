"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var _ = require("lodash");
var invariant = require("invariant");
var reduce_reducers_1 = require("reduce-reducers");
var handleAction_1 = require("./handleAction");
var ownKeys_1 = require("./ownKeys");
var isPlainObject = _.isPlainObject;
function handleActions(handlers, defaultState) {
    invariant(isPlainObject(handlers), 'Expected handlers to be an plain object.');
    var reducers = ownKeys_1.default(handlers).map(function (type) {
        return handleAction_1.default(type, handlers[type], defaultState);
    });
    var reducer = reduce_reducers_1.default.apply(void 0, reducers);
    return function (state, action) {
        if (state === void 0) { state = defaultState; }
        return reducer(state, action);
    };
}
exports.default = handleActions;
