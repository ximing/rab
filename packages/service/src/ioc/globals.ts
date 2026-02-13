/**
 * IOC 容器全局管理
 * 包括全局容器实例、全局注册表等
 */
import { Container } from './container';
/**
 * 全局实例-容器映射表
 * 使用 WeakMap 建立 Service 实例和 Container 的关系
 * WeakMap 会自动清理已销毁的实例，避免内存泄漏
 */
export const globalInstanceContainerMap: WeakMap<object, any> = new WeakMap();

/**
 * 全局容器单例
 */
let globalContainer: any = null;

/**
 * 当前正在实例化的容器
 * 用于在 Service 构造函数中获取容器
 */
let currentInstantiatingContainer: Container | null = null;

/**
 * 获取全局容器
 */
export const getGlobalContainer = (): any => {
  if (!globalContainer) {
    // 延迟导入以避免循环依赖
    globalContainer = new Container({ name: 'global' });
  }
  return globalContainer;
};

/**
 * 重置全局容器
 */
export const resetGlobalContainer = (): void => {
  if (globalContainer) {
    globalContainer.destroy();
    globalContainer = null;
  }
};

/**
 * 获取当前正在实例化的容器
 */
export const getCurrentInstantiatingContainer = (): Container | null => {
  return currentInstantiatingContainer;
};

/**
 * 设置当前正在实例化的容器
 */
export const setCurrentInstantiatingContainer = (container: Container | null): void => {
  currentInstantiatingContainer = container;
};
