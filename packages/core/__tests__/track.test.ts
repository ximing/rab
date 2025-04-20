import { observable, autorun } from 'mobx';

describe('Track specs:', () => {
  let obs: any;

  beforeEach(() => {
    obs = observable({
      aa: 11,
    });
  });

  it('setCount', () => {
    const trackFn = jest.fn(() => obs.aa);
    const scheduler = jest.fn(() => true);
    const disposer = autorun(() => {
      scheduler();
      trackFn();
    });

    expect(scheduler.mock.calls.length).toBe(1);
    expect(trackFn.mock.calls.length).toBe(1);

    obs.aa = 22;
    expect(scheduler.mock.calls.length).toBe(2);
    expect(trackFn.mock.calls.length).toBe(2);

    obs.aa = 33;
    expect(scheduler.mock.calls.length).toBe(3);
    expect(trackFn.mock.calls.length).toBe(3);

    disposer();
  });
});
