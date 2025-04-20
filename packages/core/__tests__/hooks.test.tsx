import * as React from 'react';
import { act, create, ReactTestInstance } from 'react-test-renderer';
import { useCallback, useEffect } from 'react';

import { Service, useService, Transient, view } from '../src';

const wait = (fn: (...args: any[]) => any) => Promise.resolve().then(() => fn());
const waitMacro = (fn: (...args: any[]) => any) =>
  new Promise<void>((resolve) =>
    setTimeout(() => {
      fn();
      resolve();
    })
  );

enum CountAction {
  ADD = 'add',
  MINUS = 'minus',
}

@Service()
class Count {
  count = 0;
  start = 0;

  add(count: number) {
    this.count += count;
  }

  setCount(count: number) {
    this.count = count;
  }

  async minus(count: number) {
    this.count -= count;
  }
}

const CountComponent = view(({ scope }: { scope?: any }) => {
  const countService = useService(Count, { scope: scope || Transient });

  const add = (count: number) => () => countService.add(count);
  const minus = (count: number) => () => countService.minus(count);

  return (
    <div>
      <p>
        current count is <span>{countService.count}</span>
      </p>
      <button id={CountAction.ADD} onClick={add(1)}>
        add one
      </button>
      <button id={CountAction.MINUS} onClick={minus(1)}>
        minus one
      </button>
    </div>
  );
});

describe('Hooks spec:', () => {
  describe('Default behavior', () => {
    const testRenderer = create(<CountComponent />);
    const count = () => testRenderer.root.findByType('span').children[0];
    const click = async (action: CountAction) =>
      await act(async () => testRenderer.root.findByProps({ id: action }).props.onClick());
    // https://github.com/facebook/react/issues/14050 to trigger useEffect manually
    testRenderer.update(<CountComponent />);

    it('default state work properly', () => {
      expect(count()).toBe('0');
    });

    it('Reducer action work properly', () => {
      click(CountAction.ADD);
      expect(count()).toBe('1');
    });

    it('Effect action work properly', async () => {
      click(CountAction.MINUS);
      await wait(() => expect(count()).toBe('0'));
    });

    it('should only render once when update the state right during rendering', async () => {
      const spy = jest.fn();
      const spy1 = jest.fn();
      const TestComponent = view(() => {
        const countService = useService(Count, { scope: Transient });
        const addOne = useCallback(() => countService.add(1), [countService]);

        if (countService.count % 2 === 0) {
          countService.add(1);
        }
        spy1(countService.count);
        useEffect(() => {
          spy(countService.count);
        }, [countService.count]);

        return (
          <div>
            <p>count: {countService.count}</p>
            <button onClick={addOne}>add one</button>
          </div>
        );
      });

      const renderer = create(<TestComponent />);
      expect(spy1.mock.calls).toEqual([[1], [1]]);
      // https://github.com/facebook/react/issues/14050 to trigger useEffect manually
      await act(async () => {
        renderer.update(<TestComponent />);
      });
      expect(spy.mock.calls).toEqual([[1]]);

      act(() => renderer.root.findByType('button').props.onClick());
      waitMacro(() => expect(spy1.mock.calls.length).toBe(0));
      waitMacro(() => expect(spy.mock.calls).toEqual([]));
    });

    it('should only render once when update the state right during rendering by only useService', async () => {
      const spy = jest.fn();
      const spy1 = jest.fn();
      const TestComponent = view(() => {
        const countService = useService(Count);
        const addOne = useCallback(() => countService.add(1), [countService]);
        spy1(countService.count);
        useEffect(() => {
          spy(countService.count);
        }, [countService.count]);

        return (
          <div>
            <p>count: {countService.count}</p>
            <button onClick={addOne}>add one</button>
          </div>
        );
      });

      const renderer = create(<TestComponent />);

      // https://github.com/facebook/react/issues/14050 to trigger useEffect manually
      await act(async () => {
        renderer.update(<TestComponent />);
      });
      expect(spy.mock.calls).toEqual([[0]]);

      await act(async () => await renderer.root.findByType('button').props.onClick());
      waitMacro(() => expect(spy1.mock.calls.length).toBe(0));
      waitMacro(() => expect(spy.mock.calls).toEqual([]));
    });

    it('should not trigger re-render if dont watch key', async () => {
      const spy = jest.fn();
      const TestComponent = view(() => {
        const countService = useService(Count, { scope: Transient });
        const addOne = useCallback(() => countService.add(1), [countService]);
        spy();
        return (
          <div>
            <button id={CountAction.ADD} onClick={addOne}>
              add one
            </button>
          </div>
        );
      });
      const renderer = create(<TestComponent />);
      waitMacro(() => expect(spy.mock.calls).toHaveLength(0));
      // https://github.com/facebook/react/issues/14050 to trigger useEffect manually
      renderer.update(<TestComponent />);
      act(() => renderer.root.findByProps({ id: CountAction.ADD }).props.onClick());
      waitMacro(() => expect(spy.mock.calls).toHaveLength(0));
    });

    it('should not re-render if dont watch key which is be changed', () => {
      const spy = jest.fn();
      const TestComponent = view(() => {
        const countService = useService(Count, {
          scope: Transient,
        });
        const addOne = useCallback(() => countService.add(1), [countService]);
        spy();
        return (
          <div>
            <span>start: {countService.start}</span>
            <button id={CountAction.ADD} onClick={addOne}>
              add one
            </button>
          </div>
        );
      });
      const renderer = create(<TestComponent />);
      // https://github.com/facebook/react/issues/14050 to trigger useEffect manually
      renderer.update(<TestComponent />);
      expect(spy.mock.calls).toHaveLength(1);
      act(() => renderer.root.findByProps({ id: CountAction.ADD }).props.onClick());
      expect(spy.mock.calls).toHaveLength(1);
    });
  });

  describe('Scope behavior', () => {
    describe('Same scope will share service', () => {
      const scope = Symbol('scope');
      let count: () => string | ReactTestInstance;
      let click: (action: CountAction) => void;

      beforeEach(() => {
        const testRenderer = create(<CountComponent scope={scope} />);

        count = () => testRenderer.root.findByType('span').children[0];
        click = async (action: CountAction) =>
          await act(async () => testRenderer.root.findByProps({ id: action }).props.onClick());

        // https://github.com/facebook/react/issues/14050 to trigger useEffect manually
        testRenderer.update(<CountComponent scope={scope} />);
      });

      it('default state work properly', () => {
        expect(count()).toBe('0');
      });

      it('Reducer action work properly', () => {
        click(CountAction.ADD);
        expect(count()).toBe('1');
      });

      it('Effect action work properly', async () => {
        click(CountAction.MINUS);
        await wait(() => expect(count()).toBe('0'));
      });
    });

    describe('Different scope will not share service', () => {
      const scope1 = Symbol('scope1');
      const scope2 = Symbol('scope2');
      let count1: () => string | ReactTestInstance;
      let count2: () => string | ReactTestInstance;
      let click1: (action: CountAction) => void;

      beforeEach(() => {
        const testRenderer = create(
          <div>
            <CountComponent scope={scope1} />
            <CountComponent scope={scope2} />
          </div>
        );

        const spans = testRenderer.root.findAllByType('span');
        count1 = () => spans[0].children[0];
        count2 = () => spans[1].children[0];

        const buttons = testRenderer.root.findAllByProps({ id: CountAction.ADD });
        click1 = async () => await act(async () => buttons[0].props.onClick());

        // https://github.com/facebook/react/issues/14050 to trigger useEffect manually
        testRenderer.update(
          <div>
            <CountComponent scope={scope1} />
            <CountComponent scope={scope2} />
          </div>
        );
      });

      it('default state work properly', () => {
        expect(count1()).toBe('0');
        expect(count2()).toBe('0');
      });

      it('Reducer action work properly', () => {
        click1(CountAction.ADD);
        expect(count1()).toBe('1');
        expect(count2()).toBe('0');
      });

      it('Effect action work properly', async () => {
        click1(CountAction.MINUS);
        await wait(() => expect(count1()).toBe('0'));
        expect(count2()).toBe('0');
      });
    });
  });
});
