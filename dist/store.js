'use strict';

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getReduxStore = exports.createReduxStore = void 0;

var _typeof2 = _interopRequireDefault(require("@babel/runtime/helpers/typeof"));

var _toConsumableArray2 = _interopRequireDefault(require("@babel/runtime/helpers/toConsumableArray"));

var _redux = require("redux");

var _middleware = _interopRequireDefault(require("./redux/middleware"));

var _reduxStore = null;

var createReduxStore = function createReduxStore(middlewares, initialState, createReducer, options) {
  var debug = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;
  var routerMiddleware = options.routerMiddleware,
      extraEnhancers = options.extraEnhancers;

  var _middlewares = (0, _toConsumableArray2.default)(middlewares);

  if (routerMiddleware) {
    _middlewares = [routerMiddleware, (0, _middleware.default)(debug)].concat((0, _toConsumableArray2.default)(middlewares));
  } else {
    _middlewares = [(0, _middleware.default)(debug)].concat((0, _toConsumableArray2.default)(middlewares));
  }

  var composeFn = (typeof window === "undefined" ? "undefined" : (0, _typeof2.default)(window)) === 'object' && process.env.NODE_ENV !== 'production' && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ ? window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({
    trace: true,
    maxAge: 30
  }) : _redux.compose;
  var enhancers = [_redux.applyMiddleware.apply(void 0, (0, _toConsumableArray2.default)(_middlewares))].concat((0, _toConsumableArray2.default)(extraEnhancers));
  _reduxStore = (0, _redux.createStore)(createReducer(), initialState, composeFn.apply(void 0, (0, _toConsumableArray2.default)(enhancers)));
  return _reduxStore;
};

exports.createReduxStore = createReduxStore;

var getReduxStore = function getReduxStore() {
  return _reduxStore;
};

exports.getReduxStore = getReduxStore;