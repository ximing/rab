import * as React from 'react';
import { act, create, ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { useCallback, useEffect } from 'react';

import { Service, Injectable, useService, Transient, view } from '../src';
import { useObserverState } from '../src/react/hooks/useObserverState';

const wait = (fn: (...args: any[]) => any) => Promise.resolve().then(() => fn());
const waitMacro = (fn: (...args: any[]) => any) =>
  new Promise((resolve) =>
    setTimeout(() => {
      fn();
      resolve();
    })
  );

enum CountAction {
  ADD = 'add',
  MINUS = 'minus'
}

@Injectable()
class Count extends Service {
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

      // https://github.com/facebook/react/issues/14050 to trigger useEffect manually
      await act(async () => {
        renderer.update(<TestComponent />);
      });
      expect(spy.mock.calls).toEqual([[1]]);

      act(() => renderer.root.findByType('button').props.onClick());
      waitMacro(() => expect(spy1.mock.calls.length).toBe(3));
      waitMacro(() => expect(spy.mock.calls).toEqual([[1], [3]]));
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
      waitMacro(() => expect(spy1.mock.calls.length).toBe(2));
      waitMacro(() => expect(spy.mock.calls).toEqual([[0], [1]]));
    });

    it('should only render once when update the state right during rendering by useObserverState', async () => {
      const spy = jest.fn();
      const spy1 = jest.fn();
      const TestComponent = view(() => {
        const countService = useObserverState({ count: 0 });
        const addOne = useCallback(() => (countService.count += 1), [countService]);
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
      waitMacro(() => expect(spy1.mock.calls.length).toBe(2));
      waitMacro(() => expect(spy.mock.calls).toEqual([[0], [1]]));
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
      waitMacro(() => expect(spy.mock.calls).toHaveLength(1));
      // https://github.com/facebook/react/issues/14050 to trigger useEffect manually
      renderer.update(<TestComponent />);
      act(() => renderer.root.findByProps({ id: CountAction.ADD }).props.onClick());
      waitMacro(() => expect(spy.mock.calls).toHaveLength(1));
    });

    it('should not re-render if dont watch key which is be changed', () => {
      const spy = jest.fn();
      const TestComponent = view(() => {
        const countService = useService(Count, {
          scope: Transient
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

    describe('Different scope will isolate service', () => {
      let count: () => string | ReactTestInstance;
      let click: (action: CountAction) => void;

      beforeEach(() => {
        const scope = Symbol('scope');
        const testRenderer = create(<CountComponent scope={scope} />);

        count = () => testRenderer.root.findByType('span').children[0];
        click = async (action: CountAction) =>
          await act(async () => testRenderer.root.findByProps({ id: action }).props.onClick());

        // https://github.com/facebook/react/issues/14050 to trigger useEffect manually
        testRenderer.update(<CountComponent scope={scope} />);
      });

      it('Reducer action work properly', () => {
        click(CountAction.ADD);
        expect(count()).toBe('1');
      });

      it('default state work properly', () => {
        expect(count()).toBe('0');
      });

      it('Effect action work properly', async () => {
        click(CountAction.MINUS);
        await wait(() => expect(count()).toBe('-1'));
      });
    });

    describe('TransientScope will isolate service', () => {
      let count: () => string | ReactTestInstance;
      let click: (action: CountAction) => void;
      let testRenderer: ReactTestRenderer;

      beforeEach(() => {
        testRenderer = create(<CountComponent scope={Transient} />);

        count = () => testRenderer.root.findByType('span').children[0];
        click = async (action: CountAction) =>
          await act(async () => testRenderer.root.findByProps({ id: action }).props.onClick());

        // https://github.com/facebook/react/issues/14050 to trigger useEffect manually
        testRenderer.update(<CountComponent scope={Transient} />);
      });

      it('Reducer action work properly', () => {
        click(CountAction.ADD);
        expect(count()).toBe('1');
      });

      it('default state work properly', () => {
        expect(count()).toBe('0');
      });

      it('Effect action work properly', async () => {
        click(CountAction.MINUS);
        await wait(() => expect(count()).toBe('-1'));
      });

      // it('should destroy when component unmount', () => {
      //     const spy = jest.spyOn(Service.prototype, 'destroy');
      //     act(() => testRenderer.unmount());
      //     expect(spy.mock.calls.length).toBe(1);
      // });
    });

    describe('Dynamic update scope', () => {
      const testRenderer = create(<CountComponent scope={1} />);
      const count = () => testRenderer.root.findByType('span').children[0];
      const click = async (action: CountAction) =>
        await act(async () => testRenderer.root.findByProps({ id: action }).props.onClick());

      it(`should use same Service at each update if scope didn't change`, () => {
        testRenderer.update(<CountComponent scope={1} />);
        click(CountAction.ADD);
        expect(count()).toBe('1');
      });

      it(`should use new scope's Service if scope changed`, async () => {
        testRenderer.update(<CountComponent scope={2} />);
        click(CountAction.MINUS);
        await wait(() => expect(count()).toBe('-1'));
      });

      it(`should update state to corresponding one`, () => {
        testRenderer.update(<CountComponent scope={1} />);
        expect(count()).toBe('1');
        testRenderer.update(<CountComponent scope={2} />);
        expect(count()).toBe('-1');
        testRenderer.update(<CountComponent scope={3} />);
        expect(count()).toBe('0');
      });
    });
  });
});
