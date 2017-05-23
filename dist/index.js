'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.call = exports.getState = exports.put = exports.dispatch = exports.createModel = exports.handleActions = exports.handleAction = exports.createActions = exports.createAction = undefined;

var _lib = require('./lib');

Object.defineProperty(exports, 'dispatch', {
    enumerable: true,
    get: function get() {
        return _lib.dispatch;
    }
});
Object.defineProperty(exports, 'put', {
    enumerable: true,
    get: function get() {
        return _lib.put;
    }
});
Object.defineProperty(exports, 'getState', {
    enumerable: true,
    get: function get() {
        return _lib.getState;
    }
});
Object.defineProperty(exports, 'call', {
    enumerable: true,
    get: function get() {
        return _lib.call;
    }
});

var _router = require('../router');

var _reactRouterRedux = require('react-router-redux');

var _initRab = require('./initRab');

var _initRab2 = _interopRequireDefault(_initRab);

var _createAction2 = require('./redux/createAction');

var _createAction3 = _interopRequireDefault(_createAction2);

var _createActions2 = require('./redux/createActions');

var _createActions3 = _interopRequireDefault(_createActions2);

var _handleAction2 = require('./redux/handleAction.js');

var _handleAction3 = _interopRequireDefault(_handleAction2);

var _handleActions2 = require('./redux/handleActions.js');

var _handleActions3 = _interopRequireDefault(_handleActions2);

var _createModel2 = require('./createModel.js');

var _createModel3 = _interopRequireDefault(_createModel2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.createAction = _createAction3.default;
exports.createActions = _createActions3.default;
exports.handleAction = _handleAction3.default;
exports.handleActions = _handleActions3.default;
exports.createModel = _createModel3.default;
exports.default = (0, _initRab2.default)({
    initialReducer: { routing: _reactRouterRedux.routerReducer },
    initialActions: {},
    defaultHistory: _router.browserHistory,
    routerMiddleware: _reactRouterRedux.routerMiddleware,
    setupHistory: function setupHistory(history) {
        this._history = (0, _reactRouterRedux.syncHistoryWithStore)(history, this._store);
    }
});