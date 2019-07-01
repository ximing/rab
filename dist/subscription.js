"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.listen = listen;
exports.unlisten = unlisten;
exports.removeAllListener = removeAllListener;

var _isFunction2 = _interopRequireDefault(require("lodash/isFunction"));

var _warning = _interopRequireDefault(require("warning"));

var _invariant = _interopRequireDefault(require("invariant"));

var isFunction = _isFunction2.default;

function listen(subscriptions, app, simpleMode, history) {
  var funcs = [];
  var nonFuncs = [];

  for (var key in subscriptions) {
    if (Object.prototype.hasOwnProperty.call(subscriptions, key)) {
      var sub = subscriptions[key];
      (0, _invariant.default)(typeof sub === 'function', 'app.start: subscription should be function');
      var unlistener = void 0;

      if (!simpleMode) {
        unlistener = sub({
          dispatch: app._store.dispatch,
          history: history,
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

  return {
    funcs: funcs,
    nonFuncs: nonFuncs
  };
}

function unlisten(unlisteners, namespace) {
  if (!unlisteners[namespace]) return;
  var _unlisteners$namespac = unlisteners[namespace],
      funcs = _unlisteners$namespac.funcs,
      nonFuncs = _unlisteners$namespac.nonFuncs;
  (0, _warning.default)(nonFuncs.length === 0, "[app.unmodel] subscription should return unlistener function, check these subscriptions ".concat(nonFuncs.join(', ')));
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
      if (!_iteratorNormalCompletion && _iterator.return != null) {
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

function removeAllListener(unlisteners) {
  Object.keys(unlisteners).forEach(function (key) {
    unlisten(unlisteners, key);
  });
}