import { observe, observable } from '@rabjs/observer-util';
import { sleep } from '../src/utils/helpers';

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

  self = async () => {
    return this;
  };

  self1() {
    return this;
  }
}

describe('Service specs:', () => {
  let countModel: CountModel, originModel: CountModel;

  beforeEach(() => {
    originModel = new CountModel();
    countModel = observable(originModel);
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
    observe(spy);
    expect(spy.mock.calls.length).toBe(1);
    await countModel.minus();
    expect(countModel.count).toEqual(-1);
    expect(spy.mock.calls.length).toBe(1);
    await countModel.add();
    expect(countModel.count).toEqual(0);
    expect(spy.mock.calls.length).toBe(2);
  });

  it('profile', async () => {
    const spy = jest.fn(() => countModel.profile.name);
    observe(spy);
    expect(spy.mock.calls.length).toBe(1);
    countModel.profile.firstName = 'lsfe';
    expect(countModel.profile.name).toEqual('lsfe Smith');
    expect(spy.mock.calls.length).toBe(2);
  });

  it('self', function () {
    expect(countModel.self()).toStrictEqual(originModel.self());
    expect(countModel.self1()).not.toStrictEqual(originModel.self1());
  });
});
