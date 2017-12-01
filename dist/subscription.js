'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _isFunction2 = require('lodash/isFunction');

var _isFunction3 = _interopRequireDefault(_isFunction2);

exports.listen = listen;
exports.unlisten = unlisten;

var _warning = require('warning');

var _warning2 = _interopRequireDefault(_warning);

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var isFunction = _isFunction3.default;

function listen(subscriptions, app, simpleMode) {
    var funcs = [];
    var nonFuncs = [];
    for (var key in subscriptions) {
        if (Object.prototype.hasOwnProperty.call(subscriptions, key)) {
            var sub = subscriptions[key];
            (0, _invariant2.default)(typeof sub === 'function', 'app.start: subscription should be function');
            var unlistener = void 0;
            if (!simpleMode) {
                unlistener = sub({
                    dispatch: app._store.dispatch,
                    history: app._history,
                    getState: app._store.getState
                });
            } else {
                unlistener = sub({
                    dispatch: app._store.dispatch,
                    getState: app._store.getState
                });
            }
            if (isFunction(unlistener)) {
                funcs.push(unlistener);
            } else {
                nonFuncs.push(key);
            }
        }
    }
    return { funcs: funcs, nonFuncs: nonFuncs };
}

function unlisten(unlisteners, namespace) {
    if (!unlisteners[namespace]) return;

    var _unlisteners$namespac = unlisteners[namespace],
        funcs = _unlisteners$namespac.funcs,
        nonFuncs = _unlisteners$namespac.nonFuncs;

    (0, _warning2.default)(nonFuncs.length === 0, '[app.unmodel] subscription should return unlistener function, check these subscriptions ' + nonFuncs.join(', '));
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
        for (var _iterator = funcs[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var unlistener = _step.value;

            unlistener();
        }
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion && _iterator.return) {
                _iterator.return();
            }
        } finally {
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }

    delete unlisteners[namespace];
}