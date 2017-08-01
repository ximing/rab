'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _isPlainObject2 = require('lodash/isPlainObject');

var _isPlainObject3 = _interopRequireDefault(_isPlainObject2);

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports.default = initRab;

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactRedux = require('react-redux');

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _handleActions = require('./redux/handleActions');

var _handleActions2 = _interopRequireDefault(_handleActions);

var _store = require('./store');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var isPlainObject = _isPlainObject3.default;
function initRab(createOpts) {
    var initialReducer = createOpts.initialReducer,
        defaultHistory = createOpts.defaultHistory,
        routerMiddleware = createOpts.routerMiddleware,
        setupHistory = createOpts.setupHistory;
    /**
     * Create a rab instance.
     */

    return function rab() {
        var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

        options = Object.assign({}, options, { historyFirstCall: true });
        // history and initialState does not pass to plugin
        var history = options.history || defaultHistory;
        var initialState = options.initialState || {};
        var firstCall = !!options.historyFirstCall;
        delete options.history;
        delete options.initialState;

        var app = {
            //private member variable
            _models: [],
            _router: null,
            _store: null,
            _history: null,
            _middleware: [],
            _getProvider: null,
            //public member function
            use: use,
            addModel: addModel,
            router: router,
            start: start
        };
        return app;

        /**
         * Register middleware on the application.
         *
         * @param middleware
         */
        function use(middleware) {
            this._middleware.concat(middleware);
        }

        /**
         * Register a model.
         *
         * @param model
         */
        function addModel(model) {
            model = checkModel(model);
            this._models.push(model);
        }

        /**
         * Config router. Takes a function with arguments { history, dispatch },
         * and expects router config. It use the same api as react-router,
         * return jsx elements or JavaScript Object for dynamic routing.
         *
         * @param router
         */
        function router(router) {
            (0, _invariant2.default)(typeof router === 'function', 'app.router: router should be function');
            this._router = router;
        }

        /**
         * Start the app
         * @param container selector | HTMLElement
         */
        function start(container) {
            // support selector
            if (typeof container === 'string') {
                container = document.querySelector(container);
                (0, _invariant2.default)(container, 'app.start: could not query selector: ' + container);
            }

            (0, _invariant2.default)(!container || isHTMLElement(container), 'app.start: container should be HTMLElement');
            (0, _invariant2.default)(this._router, 'app.start: router should be defined');

            // get reducers from model
            var reducers = _extends({}, initialReducer);
            var actions = {};

            this._models.forEach(function (m) {
                reducers[m.namespace] = getReducer(m.reducers, m.state);
                // actions = Object.assign(actions, m.mutations);
            });

            var extraReducers = options['extraReducers'] || {};
            (0, _invariant2.default)(Object.keys(extraReducers).every(function (key) {
                return !(key in reducers);
            }), 'app.start: extraReducers is conflict with other reducers');
            var extraEnhancers = options['extraEnhancers'] || [];
            (0, _invariant2.default)(Array.isArray(extraEnhancers), 'app.start: extraEnhancers should be array');

            // create store
            var storeOptions = { extraEnhancers: extraEnhancers, extraReducers: extraReducers };
            if (routerMiddleware) {
                storeOptions.routerMiddleware = routerMiddleware(history);
            }
            var store = this._store = (0, _store.createReduxStore)(this._middleware, initialState, reducers, storeOptions);

            // setup history
            if (setupHistory) {
                setupHistory.call(this, history);
            }

            // run subscriptions
            var _iteratorNormalCompletion = true;
            var _didIteratorError = false;
            var _iteratorError = undefined;

            try {
                for (var _iterator = this._models[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                    var model = _step.value;

                    if (model.subscriptions) {
                        for (var key in model.subscriptions) {
                            if (Object.prototype.hasOwnProperty.call(model.subscriptions, key)) {
                                var sub = model.subscriptions[key];
                                (0, _invariant2.default)(typeof sub === 'function', 'app.start: subscription should be function');
                                sub({
                                    dispatch: app._store.dispatch,
                                    history: app._history,
                                    getState: app._store.getState
                                });
                            }
                        }
                    }
                }

                // If has container, render; else, return react component
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

            if (container) {
                render(container, store, this, this._router);
            } else {
                return getProvider(store, this, this._router);
            }
        }

        // Helpers

        function isEmpty(val) {
            return val === null || val === void 0;
        }

        function getProvider(store, app, router) {
            return function (extraProps) {
                return _react2.default.createElement(
                    _reactRedux.Provider,
                    { store: store },
                    router(_extends({ app: app, history: app._history }, extraProps))
                );
            };
        }

        function render(container, store, app, router) {
            var ReactDOM = require('react-dom');
            ReactDOM.render(_react2.default.createElement(getProvider(store, app, router)), container, function () {
                setTimeout(function () {
                    if (firstCall) {
                        history.push(window.location);
                    }
                }, 100);
            });
        }

        function checkModel(m) {
            // Clone model to avoid prefixing namespace multiple times
            var model = _extends({}, m);
            var namespace = model.namespace,
                reducers = model.reducers,
                actions = model.actions;


            (0, _invariant2.default)(namespace, 'app.model: namespace should be defined');
            (0, _invariant2.default)(!app._models.some(function (model) {
                return model.namespace === namespace;
            }), 'app.model: namespace should be unique');
            (0, _invariant2.default)(!model.subscriptions || isPlainObject(model.subscriptions), 'app.model: subscriptions should be Object');
            (0, _invariant2.default)(!reducers || isPlainObject(reducers), 'app.model: reducers should be Object');
            (0, _invariant2.default)(!actions || isPlainObject(actions), 'app.model: actions should be Object');

            return model;
        }

        function isHTMLElement(node) {
            return (typeof node === 'undefined' ? 'undefined' : _typeof(node)) === 'object' && node !== null && node.nodeType && node.nodeName;
        }

        function getReducer(reducers, state) {
            if (Array.isArray(reducers)) {
                return reducers[1]((0, _handleActions2.default)(reducers[0], state));
            } else {
                return (0, _handleActions2.default)(reducers || {}, state);
            }
        }

        function defaultMutationReducer(state, action) {
            if (isPlainObject(state)) {
                return Object.assign({}, state, action.payload);
            } else if (Array.isArray(state)) {
                return action.payload;
            } else {
                return action.payload;
            }
        }
    };
}