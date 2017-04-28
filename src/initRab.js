import React from 'react';
import {Provider}from 'react-redux';
import _ from 'lodash';
import invariant from 'invariant';
import handleActions from './redux/handleActions';
import {createReduxStore} from './store'
const isPlainObject = _.isPlainObject;
export default function initRab(createOpts) {
    const {
        initialReducer,
        defaultHistory,
        routerMiddleware,
        setupHistory
    } = createOpts;
    /**
     * Create a dva instance.
     */
    return function rab(options = {}) {
        // history and initialState does not pass to plugin
        const history = options.history || defaultHistory;
        const initialState = options.initialState || {};
        delete options.history;
        delete options.initialState;

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
            router,
            start
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
            invariant(typeof router === 'function', 'app.router: router should be function');
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
                invariant(container, `app.start: could not query selector: ${container}`);
            }

            invariant(!container || isHTMLElement(container), 'app.start: container should be HTMLElement');
            invariant(this._router, 'app.start: router should be defined');

            // get reducers from model
            const reducers = {...initialReducer};
            let actions = {};

            this._models.forEach(m => {
                reducers[m.namespace] = getReducer(m.reducers, m.state);
                // actions = Object.assign(actions, m.mutations);
            })

            const extraReducers = options['extraReducers'] || {};
            invariant(
                Object.keys(extraReducers).every(key => !(key in reducers)),
                'app.start: extraReducers is conflict with other reducers',
            );
            const extraEnhancers = options['extraEnhancers'] || [];
            invariant(
                Array.isArray(extraEnhancers),
                'app.start: extraEnhancers should be array',
            );

            // create store
            let storeOptions = {extraEnhancers, extraReducers};
            if (routerMiddleware) {
                storeOptions.routerMiddleware = routerMiddleware(history);
            }
            const store = this._store = createReduxStore(this._middleware, initialState, reducers, storeOptions);

            // setup history
            if (setupHistory) {
                setupHistory.call(this, history);
            }

            // run subscriptions
            for (let model of this._models) {
                if (model.subscriptions) {
                    for (const key in model.subscriptions) {
                        if (Object.prototype.hasOwnProperty.call(model.subscriptions, key)) {
                            const sub = model.subscriptions[key];
                            invariant(typeof sub === 'function', 'app.start: subscription should be function');
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
            if (container) {
                render(container, store, this, this._router);
            } else {
                return getProvider(store, this, this._router);
            }
        }

        // Helpers

        function isEmpty(val) {
            return val === null || val === (void 0);
        }

        function getProvider(store, app, router) {
            return extraProps => (
                <Provider store={store}>
                    { router({app, history: app._history, ...extraProps}) }
                </Provider>
            );
        }

        function render(container, store, app, router) {
            const ReactDOM = require('react-dom');
            ReactDOM.render(React.createElement(getProvider(store, app, router)), container, () => {
                setTimeout(() => {
                    history.push(window.location);
                }, 100);
            });
        }

        function checkModel(m) {
            // Clone model to avoid prefixing namespace multiple times
            const model = {
                ...m
            };
            const {
                namespace,
                reducers,
                actions
            } = model;

            invariant(
                namespace,
                'app.model: namespace should be defined'
            );
            invariant(!app._models.some(model => model.namespace === namespace),
                'app.model: namespace should be unique'
            );
            invariant(!model.subscriptions || isPlainObject(model.subscriptions),
                'app.model: subscriptions should be Object'
            );
            invariant(!reducers || isPlainObject(reducers),
                'app.model: reducers should be Object'
            );
            invariant(!actions || isPlainObject(actions),
                'app.model: actions should be Object'
            );

            return model;
        }

        function isHTMLElement(node) {
            return typeof node === 'object' && node !== null && node.nodeType && node.nodeName;
        }

        function getReducer(reducers, state) {
            console.log(reducers, state, Array.isArray(reducers))
            if (Array.isArray(reducers)) {
                return reducers[1](handleActions(reducers[0], state));
            } else {
                return handleActions(reducers || {}, state);
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
