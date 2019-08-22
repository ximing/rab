import { getActionNames, reducer, model, immerReducer } from '../decorators';
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

}

const rab = new Rab();
rab.addModel(M);
rab.start();
rab.getModel(M).getActions().setState({ name: '1' });
rab.getModel(M).getActions().setState({ name: '2' });
rab.getModel(M).getActions().setState({ name: '3' });
rab.getModel(M).getActions().setImmerState({ name: '4' });
console.log(rab.getStore().getState());