/// <reference types="react" />
import createAction from './redux/createAction';
import createActions from './redux/createActions';
import handleAction from './redux/handleAction';
import handleActions from './redux/handleActions';
import { dispatch, put, getState, call } from './lib';
declare const _default: (options: import("./interface").RabOptions) => {
    _models: any[];
    _router: any;
    _store: any;
    _history: any;
    _middleware: any[];
    _getProvider: any;
    use: (middleware: any) => void;
    addModel: (model: any) => any;
    removeModel: (namespace: any) => void;
    router: (router: any) => void;
    registerRoot: (top: any) => void;
    start: (container: any) => (extraProps: any) => JSX.Element;
    destory: () => void;
};
export default _default;
export { createAction, createActions, handleAction, handleActions, dispatch, put, getState, call };
