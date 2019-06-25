"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
var _exportNames = {
  createAction: true,
  createActions: true,
  handleAction: true,
  handleActions: true,
  dispatch: true,
  put: true,
  getState: true,
  call: true
};
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

var _reactRouterDom = require("react-router-dom");

Object.keys(_reactRouterDom).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function get() {
      return _reactRouterDom[key];
    }
  });
});

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