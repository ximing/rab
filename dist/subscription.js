"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var warning = require("warning");
var _ = require("lodash");
var invariant = require("invariant");
var isFunction = _.isFunction;
function listen(subscriptions, app, simpleMode) {
    var funcs = [];
    var nonFuncs = [];
    for (var key in subscriptions) {
        if (Object.prototype.hasOwnProperty.call(subscriptions, key)) {
            var sub = subscriptions[key];
            invariant(typeof sub === 'function', 'app.start: subscription should be function');
            var unlistener = void 0;
            if (!simpleMode) {
                unlistener = sub({
                    dispatch: app._store.dispatch,
                    history: app._history,
                    getState: app._store.getState
                });
            }
            else {
                unlistener = sub({
                    dispatch: app._store.dispatch,
                    getState: app._store.getState
                });
            }
            if (isFunction(unlistener)) {
                funcs.push(unlistener);
            }
            else {
                nonFuncs.push(key);
            }
        }
    }
    return { funcs: funcs, nonFuncs: nonFuncs };
}
exports.listen = listen;
function unlisten(unlisteners, namespace) {
    if (!unlisteners[namespace])
        return;
    var _a = unlisteners[namespace], funcs = _a.funcs, nonFuncs = _a.nonFuncs;
    warning(nonFuncs.length === 0, "[app.unmodel] subscription should return unlistener function, check these subscriptions " + nonFuncs.join(', '));
    for (var _i = 0, funcs_1 = funcs; _i < funcs_1.length; _i++) {
        var unlistener = funcs_1[_i];
        unlistener();
    }
    delete unlisteners[namespace];
}
exports.unlisten = unlisten;
function removeAllListener(unlisteners) {
    Object.keys(unlisteners).forEach(function (key) {
        unlisten(unlisteners, key);
    });
}
exports.removeAllListener = removeAllListener;
