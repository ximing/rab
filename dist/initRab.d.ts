/// <reference types="react" />
import { RabOptions } from './interface';
export default function initRab(createOpts: any): (options: RabOptions) => {
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
