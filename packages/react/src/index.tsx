import * as ReactDOM from 'react-dom';
import * as React from 'react';
import { Rab, Plugin, RabConstructorOptions } from '@rabjs/core';
import { Provider } from 'react-redux';
import { createBrowserHistory, History } from 'history';
import { connectRouter, routerMiddleware } from 'connected-react-router';
import invariant from 'invariant';
import { patchHistory, isHTMLElement } from './utils';

export interface ReactRabConstructorOptions extends RabConstructorOptions {
    history?: History;
}

export class ReactRab extends Rab {
    _history: History;
    private rabHistory: History;
    private __router: any;

    constructor({ middlewares = [], extraReducers = {}, history = createBrowserHistory() }: ReactRabConstructorOptions = {}) {
        super({ middlewares, extraReducers });
        this._history = patchHistory(history);
    }

    start(container?: string | Element) {
        // support selector
        if (typeof container === 'string') {
            container = document.querySelector(container);
            invariant(container, `app.start: could not query selector: ${container}`);
        }

        invariant(
            !container || isHTMLElement(container),
            'app.start: container should be HTMLElement'
        );
        invariant(this.__router, 'app.start: router should be defined');
        const _history = this._history;
        // @ts-ignore
        this.rabHistory = {
            get location() {
                return _history.location;
            },
            get action() {
                return _history.action;
            },
            get length() {
                return _history.length;
            },
            listen(callback) {
                return _history.listen.call(_history, function(...args) {
                    const self = this;
                    setTimeout(() => {
                        callback.call(self, ...args);
                    }, 0);
                });
            }
        };
        Object.keys(_history).forEach((key) => {
            if (!this.rabHistory[key]) {
                this.rabHistory[key] = this.rabHistory[key];
            }
        });
        this.routerMiddleware = routerMiddleware(_history);
        this.reduceManager.addReduce('router', connectRouter(_history));
        super.start();
        if (container) {
            this.render(container);
        }
        return this.getProvider();
    }

    router(callback: (options: { rab: ReactRab, history: History, [key: string]: any }) => React.ReactElement) {
        this.__router = callback;
    }

    getProvider = (): React.FunctionComponent<any> => {
        return (extraProps) => (
            <Provider store={this.getStore()}>
                {this.__router({
                    rab: this,
                    history: this._history,
                    ...extraProps
                })}
            </Provider>
        );
    };

    render(container: Element) {
        ReactDOM.render(React.createElement(this.getProvider()), container);
    }
}

export * from 'connected-react-router';
export * from 'react-router-dom';
export * from 'history';
export * from 'react-redux';
export * from '@rabjs/core';