import { observable, observe } from '@rabjs/observer-util';

describe('Service specs:', () => {
  it('getState', () => {
    const counter = observable({ num: 0 });
    const spy = jest.fn();
    const fn = jest.fn(() => counter.num);
    observe(fn, {
      scheduler: () => spy(),
      lazy: false
    });
    expect(counter.num).toEqual(0);
    // expect(fn.mock.calls.length).toBe(0);
    // fn();
    expect(fn.mock.calls.length).toBe(1);
    counter.num += 10;
    expect(counter.num).toEqual(10);
    expect(spy.mock.calls.length).toBe(1);
  });
});
