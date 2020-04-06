import { container, Singleton, ServiceResult } from '@rabjs/core';
import { RouterService } from '../src';

// @ts-ignore
let mockHistory: any, routerService: ServiceResult<RouterService>;

beforeEach(() => {
  mockHistory = {
    push: jest.fn(),
    replace: jest.fn(),
    go: jest.fn(),
    goBack: jest.fn(),
    goForward: jest.fn()
  };
  routerService = container.resolveServiceInScope(RouterService, Singleton);
  routerService.history = mockHistory;
});

describe('store', () => {
  it('can call history methods', () => {
    routerService.push('/url-1');
    routerService.replace('/url-2');
    routerService.go(-1);
    routerService.goBack();
    routerService.goForward();

    expect(mockHistory.push.mock.calls.length).toBe(1);
    expect(mockHistory.push.mock.calls[0][0]).toBe('/url-1');

    expect(mockHistory.replace.mock.calls.length).toBe(1);
    expect(mockHistory.replace.mock.calls[0][0]).toBe('/url-2');

    expect(mockHistory.go.mock.calls.length).toBe(1);
    expect(mockHistory.go.mock.calls[0][0]).toBe(-1);

    expect(mockHistory.goBack.mock.calls.length).toBe(1);

    expect(mockHistory.goForward.mock.calls.length).toBe(1);
  });
});
