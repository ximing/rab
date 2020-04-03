import { Singleton, container } from '@rabjs/core';
import { createMemoryHistory, History } from 'history';
import { RouterService, syncHistoryWithStore, SynchronizedHistory } from '../src';

let history: SynchronizedHistory, memoryHistory: History, routerService: RouterService;

const matchers = {
  toEqualLocation: () => ({
    compare: (actual: any, expected: any) => {
      expected = {
        search: '',
        hash: '',
        state: undefined,
        ...expected
      };
      const passed =
        actual.pathname === expected.pathname &&
        actual.search === expected.search &&
        actual.hash === expected.hash &&
        actual.state === expected.state;
      return {
        pass: passed,
        message: passed
          ? "Location's matched"
          : `Expected location to be ${JSON.stringify(expected)} but it was ${JSON.stringify(
              actual
            )}`
      };
    }
  })
};

beforeEach(() => {
  jasmine.addMatchers(matchers);
  memoryHistory = createMemoryHistory();
  routerService = container.resolveInScope(RouterService, Singleton);
  history = syncHistoryWithStore(memoryHistory);
});

describe('syncing', () => {
  it('syncs store with history', () => {
    expect(routerService.history.action).toBe('POP');
    // @ts-ignore
    expect(routerService.location).toEqualLocation({
      pathname: '/'
    });

    history.push('/url-1');
    expect(routerService.history.action).toBe('PUSH');
    // @ts-ignore
    expect(routerService.location).toEqualLocation({
      pathname: '/url-1'
    });

    history.goBack();
    expect(routerService.history.action).toBe('POP');
    // @ts-ignore
    expect(routerService.location).toEqualLocation({
      pathname: '/'
    });

    history.goForward();
    expect(routerService.history.action).toBe('POP');
    // @ts-ignore
    expect(routerService.location).toEqualLocation({
      pathname: '/url-1'
    });

    history.replace('/url-2?animal=fish#mango');
    expect(routerService.history.action).toBe('REPLACE');
    // @ts-ignore
    expect(routerService.location).toEqualLocation({
      pathname: '/url-2',
      search: '?animal=fish',
      query: { animal: 'fish' },
      hash: '#mango'
    });
  });
  it('provides subscribe and unsubscribe functions', () => {
    expect(history.subscribe).not.toBeUndefined();
    expect(history.unsubscribe).not.toBeUndefined();

    const historyListener = jest.fn();
    const unsubscribe = history.subscribe(historyListener);

    expect(historyListener.mock.calls.length).toBe(1);
    history.push('/url-1');
    expect(historyListener.mock.calls.length).toBe(2);
    unsubscribe();
    history.push('/url-2');
    expect(historyListener.mock.calls.length).toBe(2);
  });

  it('provides a way to unsubscribe from store and history', () => {
    const historyListener = jest.fn();
    history.subscribe(historyListener);

    expect(historyListener.mock.calls.length).toBe(1);
    // @ts-ignore
    history.unsubscribe();
    history.push('/url-1');

    // @ts-ignore
    expect(routerService.location).toEqualLocation({
      pathname: '/'
    });
  });
});
