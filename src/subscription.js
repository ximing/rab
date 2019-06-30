import warning from 'warning';
import _ from 'lodash';
import invariant from 'invariant';

const isFunction = _.isFunction;

export function listen(subscriptions, app, simpleMode) {
    const funcs = [];
    const nonFuncs = [];
    const history = app._history;
    const oldListen = history.listen;
    for (const key in subscriptions) {
        if (Object.prototype.hasOwnProperty.call(subscriptions, key)) {
            const sub = subscriptions[key];
            invariant(typeof sub === 'function', 'app.start: subscription should be function');
            let unlistener;
            if (!simpleMode) {
                unlistener = sub({
                    dispatch: app._store.dispatch,
                    history: {
                        ...history,
                        listen(callback) {
                            return oldListen.call(history, function(...args) {
                                const self = this;
                                setTimeout(() => {
                                    callback.call(self, ...args);
                                }, 0);
                            });
                        }
                    },
                    getState: app._store.getState
                });
            } else {
                unlistener = sub({
                    dispatch: app._store.dispatch,
                    getState: app._store.getState
                });
            }
            if (isFunction(unlistener)) {
                funcs.push(unlistener);
            } else {
                nonFuncs.push(key);
            }
        }
    }
    return { funcs, nonFuncs };
}

export function unlisten(unlisteners, namespace) {
    if (!unlisteners[namespace]) return;

    const { funcs, nonFuncs } = unlisteners[namespace];
    warning(
        nonFuncs.length === 0,
        `[app.unmodel] subscription should return unlistener function, check these subscriptions ${nonFuncs.join(
            ', '
        )}`
    );
    for (const unlistener of funcs) {
        unlistener();
    }
    delete unlisteners[namespace];
}

export function removeAllListener(unlisteners) {
    Object.keys(unlisteners).forEach((key) => {
        unlisten(unlisteners, key);
    });
}
