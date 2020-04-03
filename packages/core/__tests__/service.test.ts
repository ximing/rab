import { Service, Transient, Injectable, container } from '../src';

@Injectable()
class CountModel extends Service {
  count = 0;

  setCount(count: number) {
    this.count = count;
  }
}

describe('Service specs:', () => {
  let countModel: CountModel;

  beforeEach(() => {
    countModel = container.resolveInScope(CountModel, Transient);
  });

  it('getState', () => {
    expect(countModel.count).toEqual(0);
    countModel.setCount(10);
    expect(countModel.count).toEqual(10);
  });

  // it('destroy', () => {
  //     countModel.destroy();
  //     actions.setCount(10);
  //     expect(countModel.getState()).toEqual({ count: 0 });
  // });
});
