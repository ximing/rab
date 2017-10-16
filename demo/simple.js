/**
 * Created by yeanzhi on 10/13/17.
 */
'use strict';
import 'babel-polyfill';

import React from 'react';
import rab, {connect, createModel, put, call} from '../main.js';

function stop(time) {
    return new Promise((res, rej) => {
        setTimeout(function () {
            res();
        }, 2000);
    });
}

const app = rab({
    simple: true
});
// 2. Model
let count = createModel({
    namespace: 'count',
    state: {
        num: 0,
        loading: false
    },
    reducers: {
        add(state, action) {
            console.log(action.payload);
            return Object.assign({}, state, {num: state.num + 1})
        },
        minus(state) {
            return Object.assign({}, state, {num: state.num - 1})
        },
        asyncAdd(state, action) {
            return Object.assign({}, state, {num: state.num + action.payload})
        },
        asyncMinus: {
            start(state, action) {
                console.log('run start', action)
                return Object.assign({}, state, {loading: true});
            },
            next(state, action) {
                return Object.assign({}, state, {num: state.num + action.payload})
            },
            throw(state, action) {
                return Object.assign({}, state, {num: state.num + action.payload})
            },
            finish(state, action) {
                console.log('run finish', action)
                return Object.assign({}, state, {loading: false});
            }
        },
        asyncNewApi: {
            start(state, action) {
                console.log('run start', action)
                return Object.assign({}, state, {loading: true});
            },
            next(state, action) {
                return Object.assign({}, state, {num: state.num + action.payload})
            },
            throw(state, action) {
                return Object.assign({}, state, {num: state.num + action.payload})
            },
            finish(state, action) {
                console.log('run finish', action)
                return Object.assign({}, state, {loading: false});
            }
        }
    },
    actions: {
        asyncAdd: (a, b, c) => async ({getState, dispatch}) => {
            console.log('----->', getState(), dispatch)
            await stop();
            return 100;
        },
        async asyncMinus() {
            await stop();
            return -100;
        },
        async asyncNewApi() {
            await stop();
            return -100;
        }
    },
    subscriptions: {
        init({dispatch}) {
        }
    }
});

app.addModel(count);

// 3. View
const App = connect(({count}) => ({
    count
}))((props) => {
    return (
        <div>
            <h2>{props.count.num}</h2>
            <h2>{!props.count.loading ? 'finish' : 'loading'}</h2>
            <button key="add" onClick={() => {
                put({type: 'count.add', payload: {a: 1}});
            }}>+
            </button>
            <button key="minus" onClick={() => {
                props.dispatch({type: 'count.minus'});
            }}>-
            </button>
            <button key="asyncadd" onClick={() => {
                props.dispatch(count.actions.asyncAdd());
            }}>ASYNC ADD
            </button>
            <button key="asyncminus" onClick={() => {
                put({type: 'count.asyncMinus', payload: {a: 1, n: 2}});
            }}>ASYNC Minus
            </button>
            <button key="asyncNewApi" onClick={() => {
                call('count.asyncNewApi', 1, 2, 3);
            }}>asyncNewApi
            </button>
        </div>
    );
});

app.registerRoot(({}) => <App/>);

// 5. Start
app.start('#demo_container');
