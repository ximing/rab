import React from 'react';
import {Provider}from 'react-redux';
import {
    createStore,
    applyMiddleware,
    compose,
    combineReducers
}from 'redux';
import isPlainObject from 'is-plain-object';
import invariant from 'invariant';
import warning from 'warning';
import {isFSA}from 'flux-standard-action';
import {handleActions,CONSTANTS}from 'xm-redux-actions';

function isPromise(val) {
    return val && typeof val.then === 'function';
}

//()=>(dispatch, getState)=>async()=>{}
//()=>(dispatch, getState)=>{}
//()=>async(dispatch,getState)=>{}


const SEP = '.';

export default function initRab(createOpts) {
    const {
        initialReducer,
        defaultHistory,
        routerMiddleware,
        setupHistory
    } = createOpts;
    let typeNamespaceMap = {};
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
            this._models.push(checkModel(model));
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
            for (const m of this._models) {
                reducers[m.namespace] = getReducer(m.reducers, m.state);
                actions = Object.assign(actions, m.mutations);
            }
            const extraReducers = options['extraReducers'] || {};
            invariant(
                Object.keys(extraReducers).every(key => !(key in reducers)),
                'app.start: extraReducers is conflict with other reducers',
            );

            // create store
            let middlewares = this._middleware;
            if (routerMiddleware) {
                middlewares = [routerMiddleware(history), ...middlewares];
            }
            let devtools = () => noop => noop;
            if (process.env.NODE_ENV !== 'production' && window.__REDUX_DEVTOOLS_EXTENSION__) {
                devtools = window.__REDUX_DEVTOOLS_EXTENSION__;
            }

            const createStoreWithMiddleware = compose(
                applyMiddleware(rabMiddleware(actions, reducers), ...middlewares),
                devtools()
            )(createStore);

            const store = this._store = createStoreWithMiddleware(createReducer(), initialState);

            function createReducer() {
                return combineReducers({
                    ...reducers, ...extraReducers
                });
            }

            // setup history
            if (setupHistory) {
                setupHistory.call(this, history);
            }

            // TODO　run subscriptions

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

        function rabMiddleware(actions, reducers) {
            return ({
                dispatch,
                getState
            }) => {
                return next => action => {
                    if (actions[action.type] && !action.handled && (action.meta? !action.meta[CONSTANTS.KEY.LIFECYCLE]:true)) {
                        let res = actions[action.type](
                            isPlainObject(action.payload) ?
                                {...action.payload} :
                                isEmpty(action.payload) ?
                                    {} :
                                    action.payload,
                            {dispatch, getState, state: getState()[typeNamespaceMap[action.type]]}
                        );
                        // console.log(actions[action.type],action,res,isPromise(res))
                        if (isPromise(res)) {
                            dispatch({
                                type:action.type,
                                payload:{},
                                meta:{
                                    ...action.meta,
                                    [CONSTANTS.KEY.LIFECYCLE]:'start'
                                }
                            });
                            res.then(
                                (result) => {
                                    dispatch({
                                        ...action,
                                        payload: result,
                                        handled: true
                                    });
                                },
                                (error) => {
                                    dispatch({
                                        ...action,
                                        payload: error,
                                        error: true,
                                        handled: true
                                    });
                                }
                            );
                        } else {
                            dispatch({
                                ...action,
                                payload: res,
                                handled: true
                            });
                        }
                    } else if (!isFSA(action)) {
                        if (typeof action === 'function') {
                            if (isPromise(action)) {
                                action.then(
                                    (result) => {
                                        dispatch({
                                            ...action,
                                                ...result
                                        });
                                    },
                                    (error) => {
                                        dispatch({
                                            error: true,
                                            ...action,
                                            ...error
                                        });
                                    }
                                );
                            } else {
                                return action(dispatch, getState);
                            }
                        }else{
                            return next(action);
                        }
                    } else if (typeof action.payload === 'function') {
                        var res = action.payload(dispatch, getState);
                        if (isPromise(res)) {
                            res.then(
                                (result) => {
                                    dispatch({
                                        ...action,
                                        payload: result
                                    });
                                },
                                (error) => {
                                    dispatch({
                                        ...action,
                                        payload: error,
                                        error: true
                                    });
                                }
                            );
                        } else {
                            dispatch({
                                ...action,
                                payload: res
                            });
                        }
                    } else {
                        next(action);
                    }
                };
            };
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
            ReactDOM.render(React.createElement(getProvider(store, app, router)), container,()=>{
                history.push(window.location);
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
                mutations
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
            invariant(!mutations || isPlainObject(mutations),
                'app.model: reducers should be Object'
            );

            function applyNamespace(type) {
                function getNamespacedReducers(reducers) {
                    return Object.keys(reducers).reduce((memo, key) => {
                        warning(
                            key.indexOf(`${namespace}${SEP}`) !== 0,
                            `app.model: ${type.slice(0, -1)} ${key} should not be prefixed with namespace ${namespace}`
                        );
                        memo[`${namespace}${SEP}${key}`] = reducers[key];
                        typeNamespaceMap[`${namespace}${SEP}${key}`] = namespace;
                        return memo;
                    }, {});
                }

                function getNamespacedMutations(mutations) {
                    return Object.keys(mutations).reduce((memo, key) => {
                        warning(
                            key.indexOf(`${namespace}${SEP}`) !== 0,
                            `app.model: ${type.slice(0, -1)} ${key} should not be prefixed with namespace ${namespace}`
                        );
                        /*
                         export let cancelShareMind = createAction(CONSTANT.CANCEL_SHARE_MIND, (fid,sid)=>async(dispatch, getState)=> {
                         let mind = await api.cancelShareMind(fid,sid);
                         return sid;
                         });
                         */
                        memo[`${namespace}${SEP}${key}`] = mutations[key];//createAction(`${namespace}${SEP}${key}`, mutations[key]);
                        typeNamespaceMap[`${namespace}${SEP}${key}`] = namespace;
                        //set default mutation reducer
                        if (model['reducers'] && !model['reducers'][`${namespace}${SEP}${key}`]) {
                            model['reducers'][`${namespace}${SEP}${key}`] = defaultMutationReducer;
                        }
                        return memo;
                    }, {});
                }

                if (model[type]) {
                    if (type === 'reducers') {
                        model[type] = getNamespacedReducers(model[type]);
                    } else if (type === 'mutations') {
                        model[type] = getNamespacedMutations(model[type]);
                    }
                }
            }

            applyNamespace('reducers');
            applyNamespace('mutations');

            return model;
        }

        function isHTMLElement(node) {
            return typeof node === 'object' && node !== null && node.nodeType && node.nodeName;
        }

        function getReducer(reducers, state) {
            //TODO Support reducer enhancer
            return handleActions(reducers || {}, state);
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
