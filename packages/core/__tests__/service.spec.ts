import { Service, Transient, Injectable, Reducer, container, ActionMethodOfService } from '../src';

interface CountState {
    count: number;
}

@Injectable()
class CountModel extends Service<CountState> {
    defaultState = { count: 0 };

    @Reducer()
    setCount(state: CountState, count: number): CountState {
        return { ...state, count };
    }
}

describe('Service specs:', () => {
    let countModel: CountModel;
    let actions: ActionMethodOfService<CountModel, CountState>;

    beforeEach(() => {
        countModel = container.resolveInScope(CountModel, Transient);
        actions = countModel.getActions();
    });

    it('getState', () => {
        expect(countModel.getState()).toEqual({ count: 0 });
        actions.setCount(10);
        expect(countModel.getState()).toEqual({ count: 10 });
    });

    // it('destroy', () => {
    //     countModel.destroy();
    //     actions.setCount(10);
    //     expect(countModel.getState()).toEqual({ count: 0 });
    // });
});
