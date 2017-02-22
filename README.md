# rab
React and redux based framework.

# Installation

`npm i --save rabjs`

# Examples
```
import React from 'react';
import rab, { connect } from 'rab';
import { Router, Route } from 'rab/router';
function stop(time) {
    return new Promise((res,rej)=>{
        setTimeout(function() {res();},2000);
    });
}
//initialize
const app = rab();
// 2. Model
app.addModel({
    namespace: 'todo',
    state: {
        list:[]
    },
    reducers: {
        add(state,action) { return {list:state.list.push(action.payload)}; },
        delete(state,action) { return Object.assign({},state,{list:state.list.filter(i=>i.title!==action.payload)}); },
        asyncAdd(state,action) { return Object.assign({},state,action.payload) }
    },
    mutations:{
        async asyncAdd({},{}) {
            await stop();
            return {
                title:`learn rab${new Date().getTime()}`,
                done:false
            };
        },
        async asyncClear({},{dispatch,getState}) {
            await stop();
            return Object.assign({},getState()['todo'],{list:[]});
        }
    }
});

// 3. View
const App = connect(({ todo }) => ({
    todo
}))((props) => {
    //this.props.dispatch({type:'todo.add',payload:{id,arg})
    return (
        <div>
            <h2>{ props.count }</h2>
            <button key="add" onClick={() => { props.dispatch({type: 'todo.add' ,payload:{title:(new Date()).getTime(),done:false}}); }}>+</button>
            <button key="minus" onClick={() => { props.dispatch({type: 'todo.delete' ,payload:123}); }}>-</button>
            <button key="asyncadd" onClick={() => { props.dispatch({type: 'todo.asyncAdd' }); }}>ASYNC ADD</button>
            <button key="asyncminus" onClick={() => { props.dispatch({type: 'todo.asyncClear' }); }}>ASYNC Minus</button>
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

```