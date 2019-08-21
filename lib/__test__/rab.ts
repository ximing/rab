import { getActionNames, reducer,model } from '../decorators';
import { Rab } from '../rab';
import { Model } from '../model';

@model('test')
class M extends Model<{
    name: string
}> {
    state = {
        name:'hello'
    };
    @reducer()
    setState(state, params) {
        return Object.assign({}, state, params);
    }
}

const rab = new Rab();
rab.addModel(M);
rab.container.resolve(M).state.name;
rab.container.resolve(M).setState({})