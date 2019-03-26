"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var connected_react_router_1 = require("connected-react-router");
var initRab_1 = require("./initRab");
var history_1 = require("history");
var createAction_1 = require("./redux/createAction");
exports.createAction = createAction_1.default;
var createActions_1 = require("./redux/createActions");
exports.createActions = createActions_1.default;
var handleAction_1 = require("./redux/handleAction");
exports.handleAction = handleAction_1.default;
var handleActions_1 = require("./redux/handleActions");
exports.handleActions = handleActions_1.default;
var lib_1 = require("./lib");
exports.dispatch = lib_1.dispatch;
exports.put = lib_1.put;
exports.getState = lib_1.getState;
exports.call = lib_1.call;
exports.default = initRab_1.default({
    initialReducer: {},
    initialActions: {},
    defaultHistory: history_1.createBrowserHistory(),
    routerMiddleware: connected_react_router_1.routerMiddleware,
    setupHistory: function (history) {
        this._history = patchHistory(history); //syncHistoryWithStore(history, this._store);
    }
});
function patchHistory(history) {
    var oldListen = history.listen;
    history.listen = function (callback) {
        if (callback.name !== 'handleLocationChange') {
            callback(history.location);
        }
        return oldListen.call(history, callback);
    };
    return history;
}
