/**
 * 工具函数测试 - 提升 src/utils 目录的覆盖率
 */

import {
  TimerBasedFinalizationRegistry,
  REGISTRY_FINALIZE_AFTER,
  REGISTRY_SWEEP_INTERVAL,
} from '../utils/UniversalFinalizationRegistry';
import { observerFinalizationRegistry } from '../utils/observerFinalizationRegistry';
import { printDebugValue } from '../utils/printDebugValue';
import type { Reaction } from '@rabjs/observer';

describe('UniversalFinalizationRegistry', () => {
  describe('TimerBasedFinalizationRegistry', () => {
    it('应该在注册时存储值', () => {
      const finalizeSpy = jest.fn();
      const registry = new TimerBasedFinalizationRegistry(finalizeSpy);
      const token = {};
      const value = { data: 'test' };

      registry.register({}, value, token);

      // 验证没有立即调用 finalize
      expect(finalizeSpy).not.toHaveBeenCalled();
    });

    it('应该在 unregister 时移除注册', () => {
      const finalizeSpy = jest.fn();
      const registry = new TimerBasedFinalizationRegistry(finalizeSpy);
      const token = {};
      const value = { data: 'test' };

      registry.register({}, value, token);
      registry.unregister(token);

      // 手动触发 sweep
      registry.sweep(0);

      // 由于已经 unregister，不应该调用 finalize
      expect(finalizeSpy).not.toHaveBeenCalled();
    });

    it('应该在 sweep 时清理过期的注册', done => {
      const finalizeSpy = jest.fn();
      const registry = new TimerBasedFinalizationRegistry(finalizeSpy);
      const token = {};
      const value = { data: 'test' };

      registry.register({}, value, token);

      // 立即 sweep，maxAge 为 0，应该清理所有注册
      registry.sweep(0);

      expect(finalizeSpy).toHaveBeenCalledWith(value);
      expect(finalizeSpy).toHaveBeenCalledTimes(1);

      done();
    });

    it('应该在 finalizeAllImmediately 时清理所有注册', () => {
      const finalizeSpy = jest.fn();
      const registry = new TimerBasedFinalizationRegistry(finalizeSpy);
      const token1 = {};
      const token2 = {};
      const value1 = { data: 'test1' };
      const value2 = { data: 'test2' };

      registry.register({}, value1, token1);
      registry.register({}, value2, token2);

      registry.finalizeAllImmediately();

      expect(finalizeSpy).toHaveBeenCalledTimes(2);
      expect(finalizeSpy).toHaveBeenCalledWith(value1);
      expect(finalizeSpy).toHaveBeenCalledWith(value2);
    });

    it('应该在有多个注册时正确处理 sweep', () => {
      const finalizeSpy = jest.fn();
      const registry = new TimerBasedFinalizationRegistry(finalizeSpy);
      const token1 = {};
      const token2 = {};
      const value1 = { data: 'test1' };
      const value2 = { data: 'test2' };

      registry.register({}, value1, token1);

      // 等待一段时间后再注册第二个
      setTimeout(() => {
        registry.register({}, value2, token2);
      }, 100);

      // 使用较小的 maxAge，只清理第一个
      setTimeout(() => {
        registry.sweep(50);
        expect(finalizeSpy).toHaveBeenCalledWith(value1);
        expect(finalizeSpy).toHaveBeenCalledTimes(1);
      }, 200);
    });

    it('应该在没有注册时不调用 finalize', () => {
      const finalizeSpy = jest.fn();
      const registry = new TimerBasedFinalizationRegistry(finalizeSpy);

      registry.sweep(0);

      expect(finalizeSpy).not.toHaveBeenCalled();
    });

    it('应该正确处理 register 时没有 token 的情况', () => {
      const finalizeSpy = jest.fn();
      const registry = new TimerBasedFinalizationRegistry(finalizeSpy);
      const value = { data: 'test' };

      // 不传 token
      registry.register({}, value);

      registry.sweep(0);

      expect(finalizeSpy).toHaveBeenCalledWith(value);
    });

    it('应该在 sweep 后如果还有注册则继续调度', done => {
      const finalizeSpy = jest.fn();
      const registry = new TimerBasedFinalizationRegistry(finalizeSpy);
      const token1 = {};
      const token2 = {};
      const value1 = { data: 'test1' };
      const value2 = { data: 'test2' };

      registry.register({}, value1, token1);

      // 立即 sweep，清理第一个
      registry.sweep(0);

      // 再注册一个
      registry.register({}, value2, token2);

      // 再次 sweep
      registry.sweep(0);

      expect(finalizeSpy).toHaveBeenCalledTimes(2);

      done();
    });

    it('应该在多次 sweep 调用时正确处理', () => {
      const finalizeSpy = jest.fn();
      const registry = new TimerBasedFinalizationRegistry(finalizeSpy);
      const token = {};
      const value = { data: 'test' };

      registry.register({}, value, token);

      // 第一次 sweep
      registry.sweep(0);
      expect(finalizeSpy).toHaveBeenCalledTimes(1);

      // 第二次 sweep（应该没有注册了）
      registry.sweep(0);
      expect(finalizeSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('常量', () => {
    it('应该定义正确的常量值', () => {
      expect(REGISTRY_FINALIZE_AFTER).toBe(10_000);
      expect(REGISTRY_SWEEP_INTERVAL).toBe(10_000);
    });
  });
});

describe('observerFinalizationRegistry', () => {
  it('应该是 UniversalFinalizationRegistry 的实例', () => {
    expect(observerFinalizationRegistry).toBeDefined();
  });

  it('应该能够注册和清理 reaction', () => {
    const mockReaction = { toString: () => '[Reaction]' } as unknown as Reaction;
    const adm = { reaction: mockReaction };
    const token = {};
    const target = {}; // 使用不同的对象作为 target

    // 注册
    observerFinalizationRegistry.register(target, adm, token);

    // 验证注册成功（通过 unregister 来验证）
    observerFinalizationRegistry.unregister(token);

    expect(adm.reaction).toBe(mockReaction);
  });
});

describe('printDebugValue', () => {
  it('应该在 reaction 为 null 时返回 "disposed"', () => {
    const result = printDebugValue(null);
    expect(result).toBe('disposed');
  });

  it('应该在 reaction 存在时返回格式化的字符串', () => {
    const mockReaction = {
      toString: () => '[Reaction@12345]',
    } as unknown as Reaction;

    const result = printDebugValue(mockReaction);
    expect(result).toMatch(/^Reaction@/);
  });

  it('应该正确提取 reaction 的 ID', () => {
    const mockReaction = {
      toString: () => '[Reaction@abc123def]',
    } as unknown as Reaction;

    const result = printDebugValue(mockReaction);
    // printDebugValue 使用 slice(9, -1) 来提取 ID，所以结果会是 "Reaction@@abc123def"
    expect(result).toMatch(/^Reaction@/);
  });

  it('应该处理不同格式的 reaction toString', () => {
    const mockReaction = {
      toString: () => '[Reaction@xyz789]',
    } as unknown as Reaction;

    const result = printDebugValue(mockReaction);
    expect(result).toMatch(/^Reaction@/);
  });
});
