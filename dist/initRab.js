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

var _redux = require('redux');

var _invariant = require('invariant');

var _invariant2 = _interopRequireDefault(_invariant);

var _handleActions = require('./redux/handleActions');

var _handleActions2 = _interopRequireDefault(_handleActions);

var _store = require('./store');

var _subscription = require('./subscription');

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

        options = Object.assign({ historyFirstCall: true, simple: false }, options);
        // history and initialState does not pass to plugin
        var history = options.history || defaultHistory;
        var initialState = options.initialState || {};
        var firstCall = !!options.historyFirstCall;
        var debug = !!options.debug;
        var simpleMode = options.simple;
        delete options.simple;
        delete options.history;
        delete options.initialState;
        delete options.debug;

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
            removeModel: removeModel,
            router: router,
            registerRoot: registerRoot,
            start: start
        };
        return app;

        /**
         * Register middleware on the application.
         *
         * @param middleware
         */
        function use(middleware) {
            this._middleware.push(middleware);
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
         * Register a model.
         *
         * @param namespace
         */
        function removeModel(namespace) {
            this._models = this._models.filter(function (m) {
                return m.namespace !== namespace;
            });
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

        function registerRoot(top) {
            (0, _invariant2.default)(typeof top === 'function', 'app.top: top should be function');
            this._router = top;
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
            var unlisteners = {};

            this._models.forEach(function (m) {
                reducers[m.namespace] = getReducer(m.reducers, m.state);
            });

            var extraReducers = options['extraReducers'] || {};
            (0, _invariant2.default)(Object.keys(extraReducers).every(function (key) {
                return !(key in reducers);
            }), 'app.start: extraReducers is conflict with other reducers');
            var extraEnhancers = options['extraEnhancers'] || [];
            (0, _invariant2.default)(Array.isArray(extraEnhancers), 'app.start: extraEnhancers should be array');
            var createReducer = function createReducer() {
                return (0, _redux.combineReducers)(_extends({}, reducers, extraReducers));
            };
            // create store
            var storeOptions = { extraEnhancers: extraEnhancers, extraReducers: extraReducers };
            if (!simpleMode && routerMiddleware) {
                storeOptions.routerMiddleware = routerMiddleware(history);
            }
            var store = this._store = (0, _store.createReduxStore)(this._middleware, initialState, createReducer, storeOptions, debug);
            store.asyncReducers = {};
            // setup history
            if (!simpleMode && setupHistory) {
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
                        unlisteners[model.namespace] = (0, _subscription.listen)(model.subscriptions, app, simpleMode);
                    }
                }

                //  async add model
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

            app.addModel = function (m) {
                checkModel(m);
                var store = app._store;
                if (m.reducers) {
                    store.asyncReducers[m.namespace] = getReducer(m.reducers, m.state);
                    store.replaceReducer(createReducer(store.asyncReducers));
                }
                if (m.subscriptions) {
                    unlisteners[m.namespace] = (0, _subscription.listen)(m.subscriptions, app, simpleMode);
                }
            };

            // async remove model
            app.removeModel = function (namespace) {
                var store = app._store;
                delete store.asyncReducers[namespace];
                delete reducers[namespace];
                store.replaceReducer(createReducer());
                store.dispatch({ type: '@@rab.UPDATE' });
                // Unlisten subscrioptions
                (0, _subscription.unlisten)(unlisteners, namespace);

                // Delete model from app._models
                app._models = app._models.filter(function (model) {
                    return model.namespace !== namespace;
                });
            };

            // If has container, render; else, return react component
            if (container) {
                render(container, store, this, this._router);
            } else {
                return getProvider(store, this, this._router);
            }
        }

        // Helpers

        function getProvider(store, app, router) {
            return function (extraProps) {
                return _react2.default.createElement(
                    _reactRedux.Provider,
                    { store: store },
                    !simpleMode ? router(_extends({ app: app, history: app._history }, extraProps)) : router(_extends({ app: app }, extraProps))
                );
            };
        }

        function render(container, store, app, router) {
            var ReactDOM = require('react-dom');
            ReactDOM.render(_react2.default.createElement(getProvider(store, app, router)), container, function () {
                setTimeout(function () {
                    if (!simpleMode && firstCall) {
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
    };
}