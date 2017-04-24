import 'babel-polyfill';

import React from 'react';
import rab, { connect } from '../index.js';
import { Router, Route } from '../router';
function stop(time) {
    return new Promise((res,rej)=>{
        setTimeout(function() {res();},2000);
    });
}
const app = rab();
// 2. Model
app.addModel({
    namespace: 'count',
    state: 0,
    reducers: {
        add(count) { return count + 1; },
        minus(count) { return count - 1; },
        asyncAdd(count,action) { return count + action.payload; }
    },
    mutations:{
        async asyncAdd({},{}) {
            await stop();
            return 100;
        },
        async asyncMinus() {
            await stop();
            return -100;
        }
    },
    subscriptions:{
        init({history, dispatch}){
            console.log('history')
            history.listen((location) => {
                console.log('init',location)
            })
        }
    }
});

// 3. View
const App = connect(({ count }) => ({
    count
}))((props) => {
    return (
        <div>
            <h2>{ props.count }</h2>
            <button key="add" onClick={() => { props.dispatch({type: 'count.add' }); }}>+</button>
            <button key="minus" onClick={() => { props.dispatch({type: 'count.minus' }); }}>-</button>
            <button key="asyncadd" onClick={() => { props.dispatch({type: 'count.asyncAdd' }); }}>ASYNC ADD</button>
            <button key="asyncminus" onClick={() => { props.dispatch({type: 'count.asyncMinus' }); }}>ASYNC Minus</button>
        </div>
    );
});

// 4. Router
app.router(({ history }) => {
    return (
        <Router history={history}>
            <Route path="/" component={App} />
        </Router>
    );
});

// 5. Start
app.start('#demo_container');
