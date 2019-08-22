import * as ReactDOM from 'react-dom';
import * as React from 'react';
import { Rab, Plugin } from '@rabjs/core';
import { Provider } from 'react-redux';
import { createBrowserHistory, History } from 'history';
import { connectRouter } from 'connected-react-router';
import { patchHistory } from './utils';

interface ReactRab extends Rab {
    render: Function;
    router: Function;
    getProvider: Function;
}

export default class ReactPlugin extends Plugin {
    rab: ReactRab;
    __router: any;
    rabHistory: History;
    _history: History;

    constructor(history: History = createBrowserHistory()) {
        super();
        this._history = patchHistory(history);
    }


    beforeStart(rab: ReactRab) {
        this.rab = rab;
        // @ts-ignore
        this.rabHistory = {
            get location() {
                return this._history.location;
            },
            get action() {
                return this._history.action;
            },
            get length() {
                return this._history.length;
            },
            listen(callback) {
                return this._history.listen.call(this._history, function(...args) {
                    const self = this;
                    setTimeout(() => {
                        callback.call(self, ...args);
                    }, 0);
                });
            }
        };
        Object.keys(history).forEach((key) => {
            if (!this.rabHistory[key]) {
                this.rabHistory[key] = this.rabHistory[key];
            }
        });
        rab.render = this.render;
        rab.router = this.router;
        rab.getProvider = this.getProvider;
        rab.reduceManager.reduces['router'] = connectRouter(this._history)

    }

    router(callback: (options: { rab: ReactRab, history: History, [key: string]: any }) => React.ReactElement) {
        this.__router = callback;
    }

    getProvider = () => {
        return (extraProps) => (
            <Provider store={this.rab.getStore()}>
                {this.__router({
                    rab: this.rab,
                    history: this.rabHistory,
                    ...extraProps
                })}
            </Provider>
        );
    };

    render(container) {
        ReactDOM.render(React.createElement(this.getProvider()), container);
    }
}