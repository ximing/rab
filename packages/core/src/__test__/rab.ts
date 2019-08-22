import { action, reducer, model, immerReducer } from '../decorators';
import { Rab } from '../rab';
import { Model } from '../model';
import { defineActionSymbols } from '../symbols';

@model('test')
class M extends Model<{
    name: string
}> {
    state = {
        name: 'hello'
    };

    @reducer()
    setState(state, params: { name: string }) {
        return Object.assign({}, state, params);
    }

    @immerReducer()
    setImmerState(state, params) {
        state.name = params.name;
    }

    @action()
    async asyncFunction(state, params) {
        await Promise.resolve(1);
        state.name = params;
    }
}

const rab = new Rab();
rab.addModel(M);
rab.start();
const modelIns = rab.getModel(M);
const actions = modelIns.getActions();
actions.setState({ name: '1' });
actions.setState({ name: '2' });
actions.setState({ name: '3' });
actions.setImmerState({ name: '4' });
(actions.asyncFunction('string') as any).then(res => {
    console.log(res, rab.getStore().getState());
});
console.log('state', rab.getStore().getState());