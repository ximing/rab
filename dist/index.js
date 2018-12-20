"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "createAction", {
  enumerable: true,
  get: function get() {
    return _createAction2.default;
  }
});
Object.defineProperty(exports, "createActions", {
  enumerable: true,
  get: function get() {
    return _createActions2.default;
  }
});
Object.defineProperty(exports, "handleAction", {
  enumerable: true,
  get: function get() {
    return _handleAction2.default;
  }
});
Object.defineProperty(exports, "handleActions", {
  enumerable: true,
  get: function get() {
    return _handleActions2.default;
  }
});
Object.defineProperty(exports, "dispatch", {
  enumerable: true,
  get: function get() {
    return _lib.dispatch;
  }
});
Object.defineProperty(exports, "put", {
  enumerable: true,
  get: function get() {
    return _lib.put;
  }
});
Object.defineProperty(exports, "getState", {
  enumerable: true,
  get: function get() {
    return _lib.getState;
  }
});
Object.defineProperty(exports, "call", {
  enumerable: true,
  get: function get() {
    return _lib.call;
  }
});
exports.default = void 0;

var _connectedReactRouter = require("connected-react-router");

var _initRab = _interopRequireDefault(require("./initRab"));

var _history = require("history");

var _createAction2 = _interopRequireDefault(require("./redux/createAction"));

var _createActions2 = _interopRequireDefault(require("./redux/createActions"));

var _handleAction2 = _interopRequireDefault(require("./redux/handleAction.js"));

var _handleActions2 = _interopRequireDefault(require("./redux/handleActions.js"));

var _lib = require("./lib");

var _default = (0, _initRab.default)({
  initialReducer: {},
  initialActions: {},
  defaultHistory: (0, _history.createBrowserHistory)(),
  routerMiddleware: _connectedReactRouter.routerMiddleware,
  setupHistory: function setupHistory(history) {
    this._history = patchHistory(history);
  }
});

exports.default = _default;

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