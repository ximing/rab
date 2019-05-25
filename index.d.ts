import { History } from 'history';
import {
    Reducer,
    AnyAction,
    ReducersMapObject,
    Dispatch,
    MiddlewareAPI,
    StoreEnhancer,
    Middleware
} from 'redux';

export type dispatch = Function;
export type put = Function;
export type call = Function;

export function getState(): any;

export interface SubscriptionAPI {
    history: History;
    dispatch: Dispatch<any>;
}
export interface SubscriptionsMapObject {
    [key: string]: Subscription;
}
export interface Model {
    namespace: string;
    state?: any;
    reducers?: ReducersMapObject | ReducersMapObjectWithEnhancer;
    actions?: EffectsMapObject;
    subscriptions?: SubscriptionsMapObject;
}
import * as routerRedux from 'connected-react-router';
export { routerRedux };
import * as router from 'react-router-dom';
export { router };

export type RabOption = {
    debug?: boolean;
    initialState?: Object;
    history?: Object;
    initialReducer?: Object;
    defaultHistory?: History;
    setupHistory?: (History) => void;
    extraReducers?: ReducersMapObject;
    extraEnhancers?: StoreEnhancer<any>[];
};
export interface RouterAPI {
    history: History;
    app: RabInstance;
}

export interface Router {
    (api?: RouterAPI): JSX.Element | Object;
}

export interface RabInstance {
    /**
     * Register an object of hooks on the application.
     *
     * @param hooks
     */
    use: (middle: Middleware) => void;

    /**
     * Register a model.
     *
     * @param model
     */
    model: (model: Model) => void;

    /**
     * Unregister a model.
     *
     * @param namespace
     */
    unmodel: (namespace: string) => void;

    /**
     * Config router. Takes a function with arguments { history, dispatch },
     * and expects router config. It use the same api as react-router,
     * return jsx elements or JavaScript Object for dynamic routing.
     *
     * @param router
     */
    router: (router: Router) => void;

    /**
     * Start the application. Selector is optional. If no selector
     * arguments, it will return a function that return JSX elements.
     *
     * @param selector
     */
    start: (selector?: HTMLElement | string) => any;

    destory: Function;
}

export default function rab(opts?: RabOption): RabInstance;
export * from 'react-redux';
export type History = History;
