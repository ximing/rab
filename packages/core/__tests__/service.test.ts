import { Service, Transient, container, ServiceResult } from '../src';
import { sleep } from '../src/utils/helpers';
import { autorun, reaction } from 'mobx';

@Service()
class CountModel {
  count = 0;

  profile = {
    firstName: 'Bob',
    lastName: 'Smith',
    get name() {
      return `${this.firstName} ${this.lastName}`;
    },
  };

  setCount(count: number) {
    this.count = count;
  }

  async add() {
    this.count += 1;
  }

  minus = async () => {
    await sleep();
    this.count -= 1;
  };
}

describe('Service specs:', () => {
  let countModel: ServiceResult<CountModel>;

  beforeEach(() => {
    countModel = container.resolveInScope(CountModel, Transient) as ServiceResult<CountModel>;
  });

  it('setCount', () => {
    expect(countModel.count).toEqual(0);
    countModel.setCount(10);
    expect(countModel.count).toEqual(10);
  });

  it('minus', async () => {
    expect(countModel.count).toEqual(0);
    await countModel.minus();
    expect(countModel.count).toEqual(-1);
  });

  it('observe', async function () {
    const spy = jest.fn(() => countModel.count);
    const disposer = autorun(spy);
    expect(spy.mock.calls.length).toBe(1);
    await countModel.minus();
    expect(countModel.count).toEqual(-1);
    expect(spy.mock.calls.length).toBe(2);
    await countModel.add();
    expect(countModel.count).toEqual(0);
    expect(spy.mock.calls.length).toBe(3);
    disposer();
  });

  it('profile', async () => {
    const spy = jest.fn(() => countModel.profile.name);
    const disposer = reaction(() => countModel.profile.name, spy);
    expect(spy.mock.calls.length).toBe(0);
    countModel.profile.firstName = 'lsfe';
    expect(countModel.profile.name).toEqual('lsfe Smith');
    expect(spy.mock.calls.length).toBe(1);
    disposer();
  });
});
