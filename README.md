# rab
React and redux based framework.

# Installation

`npm i --save rabjs`

# Examples
```
import React from 'react';
import rab, { connect } from 'rabjs';
import { Router, Route } from 'rabjs/router';
function stop(time) {
    return new Promise((res,rej)=>{
        setTimeout(function() {res();},2000);
    });
}
//1,initialize
const app = rab();
// 2. add Model
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

# Doc

## model

model就是一个js对象， 融合了action和reducer，将很多单项数据流的模板代码都封装起来
```
{
    namespace:'demo',// state 的名称，同时也是领域模型的前缀,
    state:{},//初始化的state数据
    reducers:{//reducer
        add:(state,action){},
        delete:{//action 可能抛出异常的话 ，可以使用这个方式来写reducer，正常逻辑走next，一但抛出异常走throw
            next(state,action){},
            throw(state,action){}
        }
    },
    mutations:{
        add({},{dispatch,getState,state}){},
        async delete(dispatch,getState,state){}
    },
    subscriptions:{//可以在这里进行一些路由监听
        init({history,dispatch,getState}){
            history.listen((location) => {
            const {pathname, query} = location;
            if (pathname === '/demo/index') {
                dispatch({type: 'demo.add',payload:{}});
            }
        }
    }
}
```

## dispatch

```js
// 调用 demo model 的 add方法，默认先 执行mutations下的，再去执行reducer下的【均可为空】
//如果 只有mutations下面有add方法的话，返回的js对象会直接替换 state，
//如果 mutations和reducer下面都有add方法，先执行mutations下的，返回的js对象会放到 reducer下的add方法参数中的action.payload 字段里面
//如果只有reducer有add方法的话 payload 会直接赋值给add方法中action.payload字段里面
dispatch({type:'demo.add',payload:{}})
```

## router

### 参考 

[react-router](https://github.com/ReactTraining/react-router) 和 [react-router-redux](https://github.com/reactjs/react-router-redux)

react-router-redux 默认会赋值到state.routing

