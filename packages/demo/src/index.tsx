import React from 'react';
import logger from 'redux-logger';
import { Model, model, reducer, ConnectedRouter, ReactRab, connect, Route } from '@rabjs/react';

const rab = new ReactRab({
    middlewares: [logger]
});

function stop(time) {
    return new Promise((res, rej) => {
        setTimeout(function() {
            res();
        }, 2000);
    });
}

// 2. Model
@model('count')
class Count extends Model<{
    num: number,
    loading: boolean
}> {
    state: {
        num: 0,
        loading: false
    };

    @reducer()
    add(state, params: number) {
        return Object.assign({}, state, { num: state.num + params });
    }
}

rab.addModel(Count);

// 3. View
const App = connect(({ count }) => ({
    count
}))((props: {
    count: {
        num: number,
        loading: boolean
    }
}) => {
    return (
        <div>
            <h2>{props.count.num}</h2>
            <h2>{!props.count.loading ? 'finish' : 'loading'}</h2>
            <button
                key="add"
                onClick={() => {
                    rab.getModel(Count).getActions().add(1);
                }}
            >
                +
            </button>
        </div>
    );
});

// 4. Router
rab.router(({ history }) => {
    return (
        <ConnectedRouter history={history}>
            <div>
                <Route path="/" component={App}/>
            </div>
        </ConnectedRouter>
    );
});
// 5. Start
rab.start('#demo_container');
