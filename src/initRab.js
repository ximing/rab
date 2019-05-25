import React from 'react';
import { Provider } from 'react-redux';
import { combineReducers } from 'redux';
import invariant from 'invariant';
import _ from 'lodash';
import handleActions from './redux/handleActions';
import { createReduxStore } from './store';
import { unlisten, listen, removeAllListener } from './subscription';
import createModel from './createModel';
import { removeActions, clearActions } from './actions';
import { connectRouter } from 'connected-react-router';

const isPlainObject = _.isPlainObject;

export default function initRab(createOpts) {
    const { initialReducer, defaultHistory, routerMiddleware, setupHistory } = createOpts;
    /**
     * Create a rab instance.
     */
    return function rab(options = {}) {
        options = Object.assign({ simple: false }, options);
        // history and initialState does not pass to plugin
        const history = options.history || defaultHistory;
        const initialState = options.initialState || {};
        const debug = !!options.debug;
        const simpleMode = options.simple;
        delete options.simple;
        delete options.history;
        delete options.initialState;
        delete options.debug;

        const app = {
            //private member variable
            _models: [],
            _router: null,
            _store: null,
            _history: null,
            _middleware: [],
            _getProvider: null,
            //public member function
            use,
            addModel,
            removeModel,
            router,
            registerRoot,
            start,
            destory: () => {}
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
            return model;
        }

        /**
         * Register a model.
         *
         * @param namespace
         */
        function removeModel(namespace) {
            removeActions(namespace);
            this._models = this._models.filter((m) => m.namespace !== namespace);
        }

        /**
         * Config router. Takes a function with arguments { history, dispatch },
         * and expects router config. It use the same api as react-router,
         * return jsx elements or JavaScript Object for dynamic routing.
         *
         * @param router
         */
        function router(router) {
            invariant(typeof router === 'function', 'app.router: router should be function');
            this._router = router;
        }

        function registerRoot(top) {
            invariant(typeof top === 'function', 'app.top: top should be function');
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
                invariant(container, `app.start: could not query selector: ${container}`);
            }

            invariant(
                !container || isHTMLElement(container),
                'app.start: container should be HTMLElement'
            );
            invariant(this._router, 'app.start: router should be defined');

            // get reducers from model
            const reducers = {
                router: connectRouter(history),
                ...initialReducer
            };
            const unlisteners = {};

            this._models.forEach((m) => {
                reducers[m.namespace] = getReducer(m.reducers, m.state);
            });

            const extraReducers = options['extraReducers'] || {};
            invariant(
                Object.keys(extraReducers).every((key) => !(key in reducers)),
                'app.start: extraReducers is conflict with other reducers'
            );
            const extraEnhancers = options['extraEnhancers'] || [];
            invariant(Array.isArray(extraEnhancers), 'app.start: extraEnhancers should be array');
            const createReducer = function(asyncReducers = {}) {
                return combineReducers({
                    ...reducers,
                    ...extraReducers,
                    ...asyncReducers
                });
            };
            // create store
            let storeOptions = { extraEnhancers, extraReducers };
            if (!simpleMode && routerMiddleware) {
                storeOptions.routerMiddleware = routerMiddleware(history);
            }
            const store = (this._store = createReduxStore(
                this._middleware,
                initialState,
                createReducer,
                storeOptions,
                debug
            ));
            store.asyncReducers = {};
            // setup history
            if (!simpleMode && setupHistory) {
                setupHistory.call(this, history);
            }

            // run subscriptions
            for (let model of this._models) {
                if (model.subscriptions) {
                    unlisteners[model.namespace] = listen(model.subscriptions, app, simpleMode);
                }
            }

            //  async add model
            app.addModel = (m) => {
                m = checkModel(m);
                const store = app._store;
                if (m.reducers) {
                    store.asyncReducers[m.namespace] = getReducer(m.reducers, m.state);
                    store.replaceReducer(createReducer(store.asyncReducers));
                }
                if (m.subscriptions) {
                    unlisteners[m.namespace] = listen(m.subscriptions, app, simpleMode);
                }
                return m;
            };

            // async remove model
            app.removeModel = (namespace) => {
                const store = app._store;
                delete store.asyncReducers[namespace];
                delete reducers[namespace];
                removeActions(namespace);
                store.replaceReducer(createReducer(store.asyncReducers));
                store.dispatch({ type: '@@rab.UPDATE' });
                // Unlisten subscrioptions
                unlisten(unlisteners, namespace);

                // Delete model from app._models
                app._models = app._models.filter((model) => model.namespace !== namespace);
            };

            // app destory
            app.destory = () => {
                const store = app._store;
                Object.keys(store.asyncReducers).forEach((key) => {
                    app.removeModel(key);
                });
                clearActions();
                removeAllListener(unlisteners);
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
            return (extraProps) => (
                <Provider store={store}>
                    {!simpleMode
                        ? router({ app, history: app._history, ...extraProps })
                        : router({ app, ...extraProps })}
                </Provider>
            );
        }

        function render(container, store, app, router) {
            const ReactDOM = require('react-dom');
            ReactDOM.render(React.createElement(getProvider(store, app, router)), container);
        }

        function checkModel(m) {
            // Clone model to avoid prefixing namespace multiple times
            const model = _.cloneDeep(m);
            const { namespace, reducers, actions } = model;

            invariant(namespace, 'app.model: namespace should be defined');
            invariant(
                !app._models.some((model) => model.namespace === namespace),
                'app.model: namespace should be unique'
            );
            invariant(
                !model.subscriptions || isPlainObject(model.subscriptions),
                'app.model: subscriptions should be Object'
            );
            invariant(!reducers || isPlainObject(reducers), 'app.model: reducers should be Object');
            invariant(!actions || isPlainObject(actions), 'app.model: actions should be Object');

            return createModel(model);
        }

        function isHTMLElement(node) {
            return typeof node === 'object' && node !== null && node.nodeType && node.nodeName;
        }

        function getReducer(reducers, state) {
            if (Array.isArray(reducers)) {
                return reducers[1](handleActions(reducers[0], state));
            } else {
                return handleActions(reducers || {}, state);
            }
        }
    };
}
